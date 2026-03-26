use wasm_bindgen::prelude::*;
use aes_gcm::{Aes256Gcm, Key, Nonce, KeyInit};
use aes_gcm::aead::{Aead, OsRng};
use sha2::{Sha256, Digest};
use hmac::{Hmac, Mac};
use rand::RngCore;

type HmacSha256 = Hmac<Sha256>;

/// AES-256-GCM encryption — returns JSON { ciphertext, iv, tag } as hex strings
#[wasm_bindgen]
pub fn aes_encrypt(plaintext: &str, key_hex: &str) -> Result<String, JsValue> {
    let key_bytes = hex::decode(key_hex).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    let mut iv_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut iv_bytes);
    let nonce = Nonce::from_slice(&iv_bytes);

    let ciphertext = cipher.encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| JsValue::from_str(&format!("Encryption failed: {}", e)))?;

    // Last 16 bytes are the auth tag in aes-gcm
    let (ct, tag) = ciphertext.split_at(ciphertext.len() - 16);

    Ok(serde_json::json!({
        "ciphertext": hex::encode(ct),
        "iv": hex::encode(iv_bytes),
        "tag": hex::encode(tag)
    }).to_string())
}

/// AES-256-GCM decryption
#[wasm_bindgen]
pub fn aes_decrypt(ciphertext_hex: &str, iv_hex: &str, tag_hex: &str, key_hex: &str) -> Result<String, JsValue> {
    let key_bytes = hex::decode(key_hex).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let ct_bytes = hex::decode(ciphertext_hex).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let iv_bytes = hex::decode(iv_hex).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let tag_bytes = hex::decode(tag_hex).map_err(|e| JsValue::from_str(&e.to_string()))?;

    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(&iv_bytes);

    // Concatenate ciphertext + tag for aes-gcm
    let mut combined = ct_bytes;
    combined.extend_from_slice(&tag_bytes);

    let plaintext = cipher.decrypt(nonce, combined.as_ref())
        .map_err(|e| JsValue::from_str(&format!("Decryption failed: {}", e)))?;

    String::from_utf8(plaintext).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// SHA-256 hash
#[wasm_bindgen]
pub fn sha256(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}

/// HMAC-SHA256 signing
#[wasm_bindgen]
pub fn hmac_sha256(message: &str, secret: &str) -> Result<String, JsValue> {
    let mut mac = <HmacSha256 as Mac>::new_from_slice(secret.as_bytes())
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    mac.update(message.as_bytes());
    Ok(hex::encode(mac.finalize().into_bytes()))
}

/// HMAC-SHA256 verification (constant-time)
#[wasm_bindgen]
pub fn hmac_verify(message: &str, secret: &str, expected_hex: &str) -> Result<bool, JsValue> {
    let mut mac = <HmacSha256 as Mac>::new_from_slice(secret.as_bytes())
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    mac.update(message.as_bytes());
    let expected = hex::decode(expected_hex).map_err(|e| JsValue::from_str(&e.to_string()))?;
    Ok(mac.verify_slice(&expected).is_ok())
}

/// Generate cryptographically secure random bytes as hex
#[wasm_bindgen]
pub fn random_bytes(length: usize) -> String {
    let mut bytes = vec![0u8; length];
    OsRng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}

/// Constant-time string comparison (for tokens, codes)
#[wasm_bindgen]
pub fn constant_time_eq(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.as_bytes().iter().zip(b.as_bytes()).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

// REMOVED: secure_hash_password (homebrew KDF using iterated SHA-256)
// Use bcrypt or argon2 instead. This function was a security risk.
