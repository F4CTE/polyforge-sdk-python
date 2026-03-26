use napi::bindgen_prelude::*;
use napi_derive::napi;
use aes_gcm::{Aes256Gcm, Key, Nonce, KeyInit};
use aes_gcm::aead::Aead;
use sha2::{Sha256, Digest};
use hmac::{Hmac, Mac};
use rand::RngCore;
use rand::rngs::OsRng;
use zeroize::Zeroizing;

type HmacSha256 = Hmac<Sha256>;

// ─── Envelope Encryption (DEK/KEK) ─────────────────────────────────────────

/// Generate a random 32-byte Data Encryption Key (DEK) as hex
#[napi]
pub fn generate_dek() -> String {
    let mut dek = Zeroizing::new([0u8; 32]);
    OsRng.fill_bytes(dek.as_mut());
    let hex = hex::encode(dek.as_ref());
    hex
}

/// Encrypt plaintext using AES-256-GCM. Returns JSON { ciphertext, iv, tag } as hex.
/// Key material is zeroized after use.
#[napi]
pub fn encrypt_aes256gcm(plaintext: String, key_hex: String) -> Result<String> {
    let key_bytes = Zeroizing::new(
        hex::decode(&key_hex).map_err(|e| Error::from_reason(format!("Invalid key hex: {}", e)))?
    );
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    let mut iv_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut iv_bytes);
    let nonce = Nonce::from_slice(&iv_bytes);

    let ciphertext = cipher.encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| Error::from_reason(format!("Encryption failed: {}", e)))?;

    let (ct, tag) = ciphertext.split_at(ciphertext.len() - 16);

    Ok(serde_json::json!({
        "ciphertext": hex::encode(ct),
        "iv": hex::encode(iv_bytes),
        "tag": hex::encode(tag)
    }).to_string())
}

/// Decrypt AES-256-GCM ciphertext. Key material is zeroized after use.
#[napi]
pub fn decrypt_aes256gcm(ciphertext_hex: String, iv_hex: String, tag_hex: String, key_hex: String) -> Result<String> {
    let key_bytes = Zeroizing::new(
        hex::decode(&key_hex).map_err(|e| Error::from_reason(format!("Invalid key: {}", e)))?
    );
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    let iv = hex::decode(&iv_hex).map_err(|e| Error::from_reason(format!("Invalid IV: {}", e)))?;
    let nonce = Nonce::from_slice(&iv);

    let ct = hex::decode(&ciphertext_hex).map_err(|e| Error::from_reason(format!("Invalid ciphertext: {}", e)))?;
    let tag = hex::decode(&tag_hex).map_err(|e| Error::from_reason(format!("Invalid tag: {}", e)))?;

    let mut combined = ct;
    combined.extend_from_slice(&tag);

    let mut plaintext = Zeroizing::new(
        cipher.decrypt(nonce, combined.as_ref())
            .map_err(|e| Error::from_reason(format!("Decryption failed: {}", e)))?
    );

    let result = String::from_utf8(plaintext.to_vec())
        .map_err(|e| Error::from_reason(format!("Invalid UTF-8: {}", e)))?;

    // Zeroize plaintext buffer
    plaintext.iter_mut().for_each(|b| *b = 0);

    Ok(result)
}

/// Encrypt a DEK with a KEK (envelope encryption layer)
#[napi]
pub fn wrap_dek(dek_hex: String, kek_hex: String) -> Result<String> {
    encrypt_aes256gcm(dek_hex, kek_hex)
}

/// Decrypt a DEK with a KEK
#[napi]
pub fn unwrap_dek(wrapped_json: String, kek_hex: String) -> Result<String> {
    let parsed: serde_json::Value = serde_json::from_str(&wrapped_json)
        .map_err(|e| Error::from_reason(format!("Invalid JSON: {}", e)))?;
    let ct = parsed["ciphertext"].as_str().unwrap_or_default().to_string();
    let iv = parsed["iv"].as_str().unwrap_or_default().to_string();
    let tag = parsed["tag"].as_str().unwrap_or_default().to_string();
    decrypt_aes256gcm(ct, iv, tag, kek_hex)
}

// ─── Hashing & HMAC ────────────────────────────────────────────────────────

#[napi]
pub fn sha256_hash(input: String) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}

#[napi]
pub fn hmac_sha256_sign(message: String, secret: String) -> Result<String> {
    let mut mac = <HmacSha256 as Mac>::new_from_slice(secret.as_bytes())
        .map_err(|e| Error::from_reason(format!("HMAC init failed: {}", e)))?;
    mac.update(message.as_bytes());
    Ok(hex::encode(mac.finalize().into_bytes()))
}

#[napi]
pub fn hmac_sha256_verify(message: String, secret: String, expected_hex: String) -> Result<bool> {
    let mut mac = <HmacSha256 as Mac>::new_from_slice(secret.as_bytes())
        .map_err(|e| Error::from_reason(format!("HMAC init failed: {}", e)))?;
    mac.update(message.as_bytes());
    let expected = hex::decode(&expected_hex).map_err(|e| Error::from_reason(format!("Invalid hex: {}", e)))?;
    Ok(mac.verify_slice(&expected).is_ok())
}

// ─── Random ─────────────────────────────────────────────────────────────────

#[napi]
pub fn random_bytes_hex(length: u32) -> String {
    let mut bytes = vec![0u8; length as usize];
    OsRng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}
