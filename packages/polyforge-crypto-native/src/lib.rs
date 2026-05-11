use aes_gcm::aead::{Aead, Payload};
use aes_gcm::{Aes256Gcm, Key, KeyInit, Nonce};
use hmac::{Hmac, Mac};
use k256::ecdsa::{signature::hazmat::PrehashSigner, RecoveryId, SigningKey};
use k256::FieldBytes;
use napi::bindgen_prelude::*;
use napi_derive::napi;
use rand::rngs::OsRng;
use rand::TryRngCore;
use sha2::{Digest, Sha256};
use sha3::{Digest as Keccak256Digest, Keccak256};
use zeroize::Zeroizing;
use std::sync::{Mutex, OnceLock};

type HmacSha256 = Hmac<Sha256>;

struct KekStore {
    current: Zeroizing<Vec<u8>>,
    previous: Option<Zeroizing<Vec<u8>>>,
}

static KEK_STORE: OnceLock<Mutex<KekStore>> = OnceLock::new();

fn parse_hex_key(hex_key: &str, label: &str) -> Result<Zeroizing<Vec<u8>>> {
    let key = hex::decode(hex_key)
        .map_err(|e| Error::from_reason(format!("Invalid {label}: {e}")))?;
    if key.len() != 32 {
        return Err(Error::from_reason(format!(
            "{label} must decode to exactly 32 bytes, got {}",
            key.len()
        )));
    }
    Ok(Zeroizing::new(key))
}

fn kek_store() -> Result<&'static Mutex<KekStore>> {
    KEK_STORE
        .get()
        .ok_or_else(|| Error::from_reason("KEKs have not been configured"))
}

/// Store signer-service KEKs in Rust memory instead of retaining JS string fields.
#[napi]
pub fn configure_keks(current_kek_hex: String, previous_kek_hex: Option<String>) -> Result<()> {
    let current = parse_hex_key(&current_kek_hex, "current KEK")?;
    let previous = previous_kek_hex
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| parse_hex_key(s, "previous KEK"))
        .transpose()?;

    let store = KEK_STORE.get_or_init(|| {
        Mutex::new(KekStore {
            current: Zeroizing::new(Vec::new()),
            previous: None,
        })
    });
    let mut guard = store
        .lock()
        .map_err(|_| Error::from_reason("KEK store lock poisoned"))?;
    *guard = KekStore { current, previous };
    Ok(())
}

// ─── Envelope Encryption (DEK/KEK) ─────────────────────────────────────────

/// Generate a random 32-byte Data Encryption Key (DEK) as raw bytes.
#[napi]
pub fn generate_dek() -> Buffer {
    let mut dek = Zeroizing::new([0u8; 32]);
    OsRng.try_fill_bytes(dek.as_mut()).expect("OS RNG failed");
    Buffer::from(dek.as_ref().to_vec())
}

/// Encrypt plaintext using AES-256-GCM. Returns JSON { ciphertext, iv, tag } as hex.
/// Key material is zeroized after use.
#[napi]
pub fn encrypt_aes256gcm(plaintext: String, key_hex: String) -> Result<String> {
    encrypt_aes256gcm_bytes_inner(plaintext.as_bytes(), key_hex, None)
}

/// Encrypt plaintext using AES-256-GCM with additional authenticated data.
/// `aad_hex` is authenticated but not encrypted.
#[napi]
pub fn encrypt_aes256gcm_with_aad(
    plaintext: String,
    key_hex: String,
    aad_hex: String,
) -> Result<String> {
    encrypt_aes256gcm_bytes_inner(plaintext.as_bytes(), key_hex, Some(aad_hex))
}

/// Encrypt arbitrary bytes using AES-256-GCM. Returns JSON { ciphertext, iv, tag } as hex.
/// Key material is zeroized after use.
#[napi]
pub fn encrypt_aes256gcm_bytes(plaintext: Buffer, key_hex: String) -> Result<String> {
    encrypt_aes256gcm_bytes_inner(plaintext.as_ref(), key_hex, None)
}

/// Encrypt arbitrary bytes using AES-256-GCM with additional authenticated data.
/// `aad_hex` is authenticated but not encrypted.
#[napi]
pub fn encrypt_aes256gcm_bytes_with_aad(
    plaintext: Buffer,
    key_hex: String,
    aad_hex: String,
) -> Result<String> {
    encrypt_aes256gcm_bytes_inner(plaintext.as_ref(), key_hex, Some(aad_hex))
}

fn decode_aad(aad_hex: Option<String>) -> Result<Zeroizing<Vec<u8>>> {
    match aad_hex {
        Some(hex) => {
            Ok(Zeroizing::new(hex::decode(&hex).map_err(|e| {
                Error::from_reason(format!("Invalid AAD hex: {}", e))
            })?))
        }
        None => Ok(Zeroizing::new(Vec::new())),
    }
}

fn encrypt_aes256gcm_bytes_inner(
    plaintext: &[u8],
    key_hex: String,
    aad_hex: Option<String>,
) -> Result<String> {
    let key_bytes = Zeroizing::new(
        hex::decode(&key_hex).map_err(|e| Error::from_reason(format!("Invalid key hex: {}", e)))?,
    );
    if key_bytes.len() != 32 {
        return Err(Error::from_reason(format!(
            "key must decode to exactly 32 bytes, got {}",
            key_bytes.len()
        )));
    }
    let aad_bytes = decode_aad(aad_hex)?;
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    let mut iv_bytes = [0u8; 12];
    OsRng.try_fill_bytes(&mut iv_bytes).expect("OS RNG failed");
    let nonce = Nonce::from_slice(&iv_bytes);

    let ciphertext = cipher
        .encrypt(
            nonce,
            Payload {
                msg: plaintext,
                aad: aad_bytes.as_ref(),
            },
        )
        .map_err(|e| Error::from_reason(format!("Encryption failed: {}", e)))?;

    let (ct, tag) = ciphertext.split_at(ciphertext.len() - 16);

    Ok(serde_json::json!({
        "ciphertext": hex::encode(ct),
        "iv": hex::encode(iv_bytes),
        "tag": hex::encode(tag)
    })
    .to_string())
}

fn encrypt_aes256gcm_with_key_bytes_inner(plaintext: &[u8], key_bytes: &[u8]) -> Result<String> {
    if key_bytes.len() != 32 {
        return Err(Error::from_reason(format!(
            "key must be exactly 32 bytes, got {}",
            key_bytes.len()
        )));
    }
    let key = Key::<Aes256Gcm>::from_slice(key_bytes);
    let cipher = Aes256Gcm::new(key);

    let mut iv_bytes = [0u8; 12];
    OsRng.try_fill_bytes(&mut iv_bytes).expect("OS RNG failed");
    let nonce = Nonce::from_slice(&iv_bytes);

    let ciphertext = cipher
        .encrypt(nonce, Payload { msg: plaintext, aad: b"" })
        .map_err(|e| Error::from_reason(format!("Encryption failed: {}", e)))?;

    let (ct, tag) = ciphertext.split_at(ciphertext.len() - 16);

    Ok(serde_json::json!({
        "ciphertext": hex::encode(ct),
        "iv": hex::encode(iv_bytes),
        "tag": hex::encode(tag)
    })
    .to_string())
}

fn encrypt_aes256gcm_with_raw_key_and_aad_inner(
    plaintext: &[u8],
    key_bytes: &[u8],
    aad_hex: Option<String>,
) -> Result<String> {
    if key_bytes.len() != 32 {
        return Err(Error::from_reason(format!(
            "key must be exactly 32 bytes, got {}",
            key_bytes.len()
        )));
    }
    let aad_bytes = decode_aad(aad_hex)?;
    let key = Key::<Aes256Gcm>::from_slice(key_bytes);
    let cipher = Aes256Gcm::new(key);

    let mut iv_bytes = [0u8; 12];
    OsRng.try_fill_bytes(&mut iv_bytes).expect("OS RNG failed");
    let nonce = Nonce::from_slice(&iv_bytes);

    let ciphertext = cipher
        .encrypt(
            nonce,
            Payload {
                msg: plaintext,
                aad: aad_bytes.as_ref(),
            },
        )
        .map_err(|e| Error::from_reason(format!("Encryption failed: {}", e)))?;

    let (ct, tag) = ciphertext.split_at(ciphertext.len() - 16);

    Ok(serde_json::json!({
        "ciphertext": hex::encode(ct),
        "iv": hex::encode(iv_bytes),
        "tag": hex::encode(tag)
    })
    .to_string())
}

fn decrypt_aes256gcm_with_raw_key_and_aad_inner(
    ciphertext_hex: String,
    iv_hex: String,
    tag_hex: String,
    key_bytes: &[u8],
    aad_hex: Option<String>,
) -> Result<Zeroizing<Vec<u8>>> {
    if key_bytes.len() != 32 {
        return Err(Error::from_reason(format!(
            "key must be exactly 32 bytes, got {}",
            key_bytes.len()
        )));
    }
    let aad_bytes = decode_aad(aad_hex)?;
    let key = Key::<Aes256Gcm>::from_slice(key_bytes);
    let cipher = Aes256Gcm::new(key);

    let iv = hex::decode(&iv_hex).map_err(|e| Error::from_reason(format!("Invalid IV: {}", e)))?;
    if iv.len() != 12 {
        return Err(Error::from_reason(format!(
            "IV must be exactly 12 bytes for GCM, got {}",
            iv.len()
        )));
    }
    let nonce = Nonce::from_slice(&iv);

    let ct = hex::decode(&ciphertext_hex)
        .map_err(|e| Error::from_reason(format!("Invalid ciphertext: {}", e)))?;
    let tag =
        hex::decode(&tag_hex).map_err(|e| Error::from_reason(format!("Invalid tag: {}", e)))?;

    let mut combined = ct;
    combined.extend_from_slice(&tag);

    let plaintext = Zeroizing::new(
        cipher
            .decrypt(
                nonce,
                Payload {
                    msg: combined.as_ref(),
                    aad: aad_bytes.as_ref(),
                },
            )
            .map_err(|e| Error::from_reason(format!("Decryption failed: {}", e)))?,
    );

    Ok(plaintext)
}

/// Encrypt arbitrary bytes using a raw 32-byte key Buffer.
#[napi]
pub fn encrypt_aes256gcm_bytes_with_raw_key(plaintext: Buffer, key: Buffer) -> Result<String> {
    if key.len() != 32 {
        return Err(Error::from_reason(format!(
            "key must be exactly 32 bytes, got {}",
            key.len()
        )));
    }
    encrypt_aes256gcm_with_key_bytes_inner(plaintext.as_ref(), key.as_ref())
}

/// Encrypt arbitrary bytes using a raw 32-byte key Buffer with additional authenticated data.
/// AAD is authenticated but not encrypted.  The key stays as a raw Buffer
/// through the NAPI boundary — no hex-string conversion in JavaScript.
#[napi]
pub fn encrypt_aes256gcm_bytes_with_raw_key_and_aad(
    plaintext: Buffer,
    key: Buffer,
    aad_hex: String,
) -> Result<String> {
    encrypt_aes256gcm_with_raw_key_and_aad_inner(plaintext.as_ref(), key.as_ref(), Some(aad_hex))
}

/// Encrypt arbitrary bytes using the configured current KEK.
#[napi]
pub fn encrypt_aes256gcm_bytes_with_configured_kek(plaintext: Buffer) -> Result<String> {
    let store = kek_store()?;
    let guard = store
        .lock()
        .map_err(|_| Error::from_reason("KEK store lock poisoned"))?;
    encrypt_aes256gcm_with_key_bytes_inner(plaintext.as_ref(), &guard.current)
}

/// Decrypt AES-256-GCM ciphertext. Key material is zeroized after use.
#[napi]
pub fn decrypt_aes256gcm(
    ciphertext_hex: String,
    iv_hex: String,
    tag_hex: String,
    key_hex: String,
) -> Result<String> {
    let mut plaintext =
        decrypt_aes256gcm_bytes_inner(ciphertext_hex, iv_hex, tag_hex, key_hex, None)?;
    let result = String::from_utf8(plaintext.to_vec())
        .map_err(|e| Error::from_reason(format!("Invalid UTF-8: {}", e)))?;

    // Zeroize plaintext buffer
    plaintext.iter_mut().for_each(|b| *b = 0);

    Ok(result)
}

/// Decrypt AES-256-GCM ciphertext with additional authenticated data.
#[napi]
pub fn decrypt_aes256gcm_with_aad(
    ciphertext_hex: String,
    iv_hex: String,
    tag_hex: String,
    key_hex: String,
    aad_hex: String,
) -> Result<String> {
    let mut plaintext =
        decrypt_aes256gcm_bytes_inner(ciphertext_hex, iv_hex, tag_hex, key_hex, Some(aad_hex))?;
    let result = String::from_utf8(plaintext.to_vec())
        .map_err(|e| Error::from_reason(format!("Invalid UTF-8: {}", e)))?;

    // Zeroize plaintext buffer
    plaintext.iter_mut().for_each(|b| *b = 0);

    Ok(result)
}

/// Decrypt AES-256-GCM ciphertext as arbitrary bytes. Key material is zeroized after use.
#[napi]
pub fn decrypt_aes256gcm_bytes(
    ciphertext_hex: String,
    iv_hex: String,
    tag_hex: String,
    key_hex: String,
) -> Result<Buffer> {
    let mut plaintext =
        decrypt_aes256gcm_bytes_inner(ciphertext_hex, iv_hex, tag_hex, key_hex, None)?;
    let result = Buffer::from(plaintext.to_vec());

    // Zeroize plaintext buffer
    plaintext.iter_mut().for_each(|b| *b = 0);

    Ok(result)
}

/// Decrypt AES-256-GCM ciphertext as arbitrary bytes with additional authenticated data.
#[napi]
pub fn decrypt_aes256gcm_bytes_with_aad(
    ciphertext_hex: String,
    iv_hex: String,
    tag_hex: String,
    key_hex: String,
    aad_hex: String,
) -> Result<Buffer> {
    let mut plaintext =
        decrypt_aes256gcm_bytes_inner(ciphertext_hex, iv_hex, tag_hex, key_hex, Some(aad_hex))?;
    let result = Buffer::from(plaintext.to_vec());

    // Zeroize plaintext buffer
    plaintext.iter_mut().for_each(|b| *b = 0);

    Ok(result)
}

fn decrypt_aes256gcm_bytes_inner(
    ciphertext_hex: String,
    iv_hex: String,
    tag_hex: String,
    key_hex: String,
    aad_hex: Option<String>,
) -> Result<Zeroizing<Vec<u8>>> {
    let key_bytes = Zeroizing::new(
        hex::decode(&key_hex).map_err(|e| Error::from_reason(format!("Invalid key: {}", e)))?,
    );
    if key_bytes.len() != 32 {
        return Err(Error::from_reason(format!(
            "key must decode to exactly 32 bytes, got {}",
            key_bytes.len()
        )));
    }
    let aad_bytes = decode_aad(aad_hex)?;
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    let iv = hex::decode(&iv_hex).map_err(|e| Error::from_reason(format!("Invalid IV: {}", e)))?;
    if iv.len() != 12 {
        return Err(Error::from_reason(format!(
            "IV must be exactly 12 bytes for GCM, got {}",
            iv.len()
        )));
    }
    let nonce = Nonce::from_slice(&iv);

    let ct = hex::decode(&ciphertext_hex)
        .map_err(|e| Error::from_reason(format!("Invalid ciphertext: {}", e)))?;
    let tag =
        hex::decode(&tag_hex).map_err(|e| Error::from_reason(format!("Invalid tag: {}", e)))?;

    let mut combined = ct;
    combined.extend_from_slice(&tag);

    let plaintext = Zeroizing::new(
        cipher
            .decrypt(
                nonce,
                Payload {
                    msg: combined.as_ref(),
                    aad: aad_bytes.as_ref(),
                },
            )
            .map_err(|e| Error::from_reason(format!("Decryption failed: {}", e)))?,
    );

    Ok(plaintext)
}

fn decrypt_aes256gcm_with_key_bytes_inner(ciphertext_hex: String, iv_hex: String, tag_hex: String, key_bytes: &[u8]) -> Result<Zeroizing<Vec<u8>>> {
    if key_bytes.len() != 32 {
        return Err(Error::from_reason(format!(
            "key must be exactly 32 bytes, got {}",
            key_bytes.len()
        )));
    }
    let key = Key::<Aes256Gcm>::from_slice(key_bytes);
    let cipher = Aes256Gcm::new(key);

    let iv = hex::decode(&iv_hex).map_err(|e| Error::from_reason(format!("Invalid IV: {}", e)))?;
    if iv.len() != 12 {
        return Err(Error::from_reason(format!(
            "IV must be exactly 12 bytes for GCM, got {}",
            iv.len()
        )));
    }
    let nonce = Nonce::from_slice(&iv);

    let ct = hex::decode(&ciphertext_hex)
        .map_err(|e| Error::from_reason(format!("Invalid ciphertext: {}", e)))?;
    let tag =
        hex::decode(&tag_hex).map_err(|e| Error::from_reason(format!("Invalid tag: {}", e)))?;

    let mut combined = ct;
    combined.extend_from_slice(&tag);

    let plaintext = Zeroizing::new(
        cipher
            .decrypt(nonce, Payload { msg: combined.as_ref(), aad: b"" })
            .map_err(|e| Error::from_reason(format!("Decryption failed: {}", e)))?,
    );

    Ok(plaintext)
}

/// Decrypt AES-256-GCM ciphertext as bytes using a raw 32-byte key Buffer.
#[napi]
pub fn decrypt_aes256gcm_bytes_with_raw_key(ciphertext_hex: String, iv_hex: String, tag_hex: String, key: Buffer) -> Result<Buffer> {
    if key.len() != 32 {
        return Err(Error::from_reason(format!(
            "key must be exactly 32 bytes, got {}",
            key.len()
        )));
    }
    let mut plaintext = decrypt_aes256gcm_with_key_bytes_inner(ciphertext_hex, iv_hex, tag_hex, key.as_ref())?;
    let result = Buffer::from(plaintext.to_vec());
    plaintext.iter_mut().for_each(|b| *b = 0);
    Ok(result)
}

/// Decrypt AES-256-GCM ciphertext as bytes using a raw 32-byte key Buffer
/// with additional authenticated data.  The key stays as a raw Buffer
/// through the NAPI boundary — no hex-string conversion in JavaScript.
#[napi]
pub fn decrypt_aes256gcm_bytes_with_raw_key_and_aad(
    ciphertext_hex: String,
    iv_hex: String,
    tag_hex: String,
    key: Buffer,
    aad_hex: String,
) -> Result<Buffer> {
    let mut plaintext = decrypt_aes256gcm_with_raw_key_and_aad_inner(
        ciphertext_hex,
        iv_hex,
        tag_hex,
        key.as_ref(),
        Some(aad_hex),
    )?;
    let result = Buffer::from(plaintext.to_vec());
    plaintext.iter_mut().for_each(|b| *b = 0);
    Ok(result)
}

/// Decrypt AES-256-GCM ciphertext as bytes using the configured current KEK.
#[napi]
pub fn decrypt_aes256gcm_bytes_with_configured_kek(ciphertext_hex: String, iv_hex: String, tag_hex: String) -> Result<Buffer> {
    let store = kek_store()?;
    let guard = store
        .lock()
        .map_err(|_| Error::from_reason("KEK store lock poisoned"))?;
    let mut plaintext = decrypt_aes256gcm_with_key_bytes_inner(ciphertext_hex, iv_hex, tag_hex, &guard.current)?;
    let result = Buffer::from(plaintext.to_vec());
    plaintext.iter_mut().for_each(|b| *b = 0);
    Ok(result)
}

/// Encrypt a DEK with a KEK (envelope encryption layer)
#[napi]
pub fn wrap_dek(dek_hex: String, kek_hex: String) -> Result<String> {
    encrypt_aes256gcm(dek_hex, kek_hex)
}

/// Encrypt a DEK with a KEK and additional authenticated data.
#[napi]
pub fn wrap_dek_with_aad(dek_hex: String, kek_hex: String, aad_hex: String) -> Result<String> {
    encrypt_aes256gcm_with_aad(dek_hex, kek_hex, aad_hex)
}

/// Decrypt a DEK with a KEK
#[napi]
pub fn unwrap_dek(wrapped_json: String, kek_hex: String) -> Result<String> {
    let parsed: serde_json::Value = serde_json::from_str(&wrapped_json)
        .map_err(|e| Error::from_reason(format!("Invalid JSON: {}", e)))?;
    let ct = parsed["ciphertext"]
        .as_str()
        .unwrap_or_default()
        .to_string();
    let iv = parsed["iv"].as_str().unwrap_or_default().to_string();
    let tag = parsed["tag"].as_str().unwrap_or_default().to_string();
    decrypt_aes256gcm(ct, iv, tag, kek_hex)
}

/// Decrypt a DEK with a KEK and additional authenticated data.
#[napi]
pub fn unwrap_dek_with_aad(
    wrapped_json: String,
    kek_hex: String,
    aad_hex: String,
) -> Result<String> {
    let parsed: serde_json::Value = serde_json::from_str(&wrapped_json)
        .map_err(|e| Error::from_reason(format!("Invalid JSON: {}", e)))?;
    let ct = parsed["ciphertext"]
        .as_str()
        .unwrap_or_default()
        .to_string();
    let iv = parsed["iv"].as_str().unwrap_or_default().to_string();
    let tag = parsed["tag"].as_str().unwrap_or_default().to_string();
    decrypt_aes256gcm_with_aad(ct, iv, tag, kek_hex, aad_hex)
}

/// Encrypt a raw DEK Buffer with the configured current KEK.
#[napi]
pub fn wrap_dek_with_current_kek(dek: Buffer) -> Result<String> {
    if dek.len() != 32 {
        return Err(Error::from_reason(format!(
            "DEK must be exactly 32 bytes, got {}",
            dek.len()
        )));
    }
    let store = kek_store()?;
    let guard = store
        .lock()
        .map_err(|_| Error::from_reason("KEK store lock poisoned"))?;
    encrypt_aes256gcm_with_key_bytes_inner(dek.as_ref(), &guard.current)
}

/// Encrypt a raw DEK Buffer with the configured current KEK using additional
/// authenticated data.  The DEK stays as a raw Buffer through the NAPI
/// boundary — no hex-string conversion in JavaScript.
#[napi]
pub fn wrap_dek_with_current_kek_and_aad(
    dek: Buffer,
    aad_hex: String,
) -> Result<String> {
    if dek.len() != 32 {
        return Err(Error::from_reason(format!(
            "DEK must be exactly 32 bytes, got {}",
            dek.len()
        )));
    }
    let store = kek_store()?;
    let guard = store
        .lock()
        .map_err(|_| Error::from_reason("KEK store lock poisoned"))?;
    encrypt_aes256gcm_with_raw_key_and_aad_inner(dek.as_ref(), &guard.current, Some(aad_hex))
}

/// Decrypt a stored DEK using the configured current or previous KEK.
#[napi]
pub fn decrypt_dek_with_stored_kek(ciphertext_hex: String, iv_hex: String, tag_hex: String, use_previous: bool) -> Result<Buffer> {
    let store = kek_store()?;
    let guard = store
        .lock()
        .map_err(|_| Error::from_reason("KEK store lock poisoned"))?;
    let key = if use_previous {
        guard
            .previous
            .as_ref()
            .ok_or_else(|| Error::from_reason("Previous KEK is not configured"))?
    } else {
        &guard.current
    };
    let mut plaintext = decrypt_aes256gcm_with_key_bytes_inner(ciphertext_hex, iv_hex, tag_hex, key)?;
    let result = Buffer::from(plaintext.to_vec());
    plaintext.iter_mut().for_each(|b| *b = 0);
    Ok(result)
}

/// Decrypt a stored DEK using the configured current or previous KEK with
/// additional authenticated data.  Returns raw DEK Buffer rather than a
/// hex string so key material never enters the V8 heap as an immutable string.
#[napi]
pub fn unwrap_dek_with_aad_raw(
    wrapped_json: String,
    use_previous: bool,
    aad_hex: String,
) -> Result<Buffer> {
    let parsed: serde_json::Value = serde_json::from_str(&wrapped_json)
        .map_err(|e| Error::from_reason(format!("Invalid JSON: {}", e)))?;
    let ct = parsed["ciphertext"]
        .as_str()
        .unwrap_or_default()
        .to_string();
    let iv = parsed["iv"].as_str().unwrap_or_default().to_string();
    let tag = parsed["tag"].as_str().unwrap_or_default().to_string();

    let store = kek_store()?;
    let guard = store
        .lock()
        .map_err(|_| Error::from_reason("KEK store lock poisoned"))?;
    let key = if use_previous {
        guard
            .previous
            .as_ref()
            .ok_or_else(|| Error::from_reason("Previous KEK is not configured"))?
    } else {
        &guard.current
    };

    let mut plaintext = decrypt_aes256gcm_with_raw_key_and_aad_inner(
        ct, iv, tag, key, Some(aad_hex),
    )?;
    let result = Buffer::from(plaintext.to_vec());
    plaintext.iter_mut().for_each(|b| *b = 0);
    Ok(result)
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
    let expected = hex::decode(&expected_hex)
        .map_err(|e| Error::from_reason(format!("Invalid hex: {}", e)))?;
    Ok(mac.verify_slice(&expected).is_ok())
}

// ─── Random ─────────────────────────────────────────────────────────────────

#[napi]
pub fn random_bytes_hex(length: u32) -> String {
    let mut bytes = vec![0u8; length as usize];
    OsRng.try_fill_bytes(&mut bytes).expect("OS RNG failed");
    hex::encode(bytes)
}

// ─── Keccak-256 (Ethereum hash) ──────────────────────────────────────────────

/// Compute a Keccak-256 hash of the input bytes.
/// This is the hash function used by Ethereum (different from NIST SHA3-256).
#[napi]
pub fn keccak256(input: Buffer) -> Buffer {
    let mut hasher = Keccak256::new();
    Keccak256Digest::update(&mut hasher, input.as_ref());
    Buffer::from(Keccak256Digest::finalize(hasher).to_vec())
}

// ─── Ethereum address derivation ────────────────────────────────────────────

/// Derive an Ethereum address (20 bytes) from a secp256k1 private key (32 bytes).
///
/// Algorithm: privateKey → uncompressed public key (64 bytes, strip 04 prefix)
/// → keccak256 → take last 20 bytes.
///
/// SECURITY: The private key bytes are held in a `Zeroizing` wrapper and are
/// wiped from Rust memory as soon as this function returns.
#[napi]
pub fn private_key_to_eth_address(private_key: Buffer) -> Result<Buffer> {
    private_key_bytes_to_eth_address_inner(private_key.as_ref())
}

/// Derive an Ethereum address from a private key supplied as the ASCII bytes of
/// a "0x"-prefixed hex string (e.g. the bytes of `"0xabcd..."`).
///
/// This variant is used when the key is stored as a hex-encoded Buffer so the
/// raw 32-byte key material never needs to be decoded in JavaScript — all hex
/// decoding happens in Rust memory with zeroization on completion.
#[napi]
pub fn private_key_hex_bytes_to_eth_address(private_key_hex_bytes: Buffer) -> Result<Buffer> {
    let hex_str = std::str::from_utf8(private_key_hex_bytes.as_ref()).map_err(|e| {
        Error::from_reason(format!("private_key_hex_bytes is not valid UTF-8: {e}"))
    })?;
    let hex_str = hex_str.trim_start_matches("0x").trim_start_matches("0X");
    let raw = Zeroizing::new(
        hex::decode(hex_str)
            .map_err(|e| Error::from_reason(format!("invalid hex in private key: {e}")))?,
    );
    private_key_bytes_to_eth_address_inner(&raw)
}

/// Sign a 32-byte digest where the private key is provided as the ASCII bytes
/// of a "0x"-prefixed hex string (e.g. the bytes of `"0xabcd..."`).
///
/// This variant is used when the key is stored as a hex-encoded Buffer so the
/// raw 32-byte key material never needs to be decoded in JavaScript — all hex
/// decoding and ECDSA signing happen in Rust memory with full zeroization.
///
/// Returns 65 bytes: [r (32) | s (32) | v (1)] (Ethereum recovery format).
#[napi]
pub fn sign_secp256k1_hex_key(private_key_hex_bytes: Buffer, digest: Buffer) -> Result<Buffer> {
    if digest.len() != 32 {
        return Err(Error::from_reason(format!(
            "digest must be exactly 32 bytes, got {}",
            digest.len()
        )));
    }
    let hex_str = std::str::from_utf8(private_key_hex_bytes.as_ref()).map_err(|e| {
        Error::from_reason(format!("private_key_hex_bytes is not valid UTF-8: {e}"))
    })?;
    let hex_str = hex_str.trim_start_matches("0x").trim_start_matches("0X");
    let raw_bytes = Zeroizing::new(
        hex::decode(hex_str)
            .map_err(|e| Error::from_reason(format!("invalid hex in private key: {e}")))?,
    );
    if raw_bytes.len() != 32 {
        return Err(Error::from_reason(format!(
            "decoded private key must be 32 bytes, got {}",
            raw_bytes.len()
        )));
    }
    sign_secp256k1_raw(&raw_bytes, digest.as_ref())
}

/// Sign a 32-byte digest using secp256k1 ECDSA (Ethereum-compatible).
///
/// - `private_key`: exactly 32 bytes; zeroized in Rust memory after use.
/// - `digest`: exactly 32 bytes (the pre-hashed message, e.g. an EIP-712 hash).
///
/// Returns 65 bytes: [r (32) | s (32) | v (1)], where v is 27 or 28
/// (Ethereum-style recovery ID with the +27 offset applied).
///
/// SECURITY: The private key bytes are held in a `Zeroizing` wrapper and are
/// wiped from Rust memory as soon as this function returns.
#[napi]
pub fn sign_secp256k1(private_key: Buffer, digest: Buffer) -> Result<Buffer> {
    if private_key.len() != 32 {
        return Err(Error::from_reason(format!(
            "private_key must be exactly 32 bytes, got {}",
            private_key.len()
        )));
    }
    sign_secp256k1_raw(private_key.as_ref(), digest.as_ref())
}

// ─── Internal helpers (not exported to NAPI) ─────────────────────────────────

fn private_key_bytes_to_eth_address_inner(raw_key: &[u8]) -> Result<Buffer> {
    if raw_key.len() != 32 {
        return Err(Error::from_reason(format!(
            "private_key must be exactly 32 bytes, got {}",
            raw_key.len()
        )));
    }

    let pk_bytes: Zeroizing<[u8; 32]> = Zeroizing::new(
        raw_key
            .try_into()
            .map_err(|_| Error::from_reason("failed to copy private key bytes"))?,
    );

    let signing_key = SigningKey::from_bytes(FieldBytes::from_slice(pk_bytes.as_ref()))
        .map_err(|e| Error::from_reason(format!("invalid private key: {e}")))?;

    // Get the uncompressed public key (65 bytes: 04 prefix + x + y)
    let verifying_key = signing_key.verifying_key();
    let pub_key = verifying_key.to_encoded_point(false /* uncompressed */);
    let pub_key_bytes = pub_key.as_bytes();
    // Strip the 04 prefix to get the 64-byte x||y
    let pub_key_xy = &pub_key_bytes[1..];

    // keccak256 of the 64-byte public key → take last 20 bytes as Ethereum address
    let mut hasher = Keccak256::new();
    Keccak256Digest::update(&mut hasher, pub_key_xy);
    let hash = Keccak256Digest::finalize(hasher);
    let address_bytes = &hash[12..]; // last 20 bytes

    Ok(Buffer::from(address_bytes.to_vec()))
}

/// Internal secp256k1 signing helper operating on raw slices.
/// Accepts raw key bytes (must be exactly 32) and a pre-hashed digest (must be exactly 32).
fn sign_secp256k1_raw(raw_key: &[u8], digest: &[u8]) -> Result<Buffer> {
    if digest.len() != 32 {
        return Err(Error::from_reason(format!(
            "digest must be exactly 32 bytes, got {}",
            digest.len()
        )));
    }

    // Copy key bytes into a Zeroizing wrapper so they are wiped on drop.
    let pk_bytes: Zeroizing<[u8; 32]> = Zeroizing::new(raw_key.try_into().map_err(|_| {
        Error::from_reason(format!(
            "raw_key must be exactly 32 bytes, got {}",
            raw_key.len()
        ))
    })?);

    let signing_key = SigningKey::from_bytes(FieldBytes::from_slice(pk_bytes.as_ref()))
        .map_err(|e| Error::from_reason(format!("invalid private key: {e}")))?;

    let digest_arr: &[u8; 32] = digest
        .try_into()
        .map_err(|_| Error::from_reason("failed to convert digest to [u8; 32]"))?;

    let (sig, recovery_id): (k256::ecdsa::Signature, RecoveryId) = signing_key
        .sign_prehash(digest_arr)
        .map_err(|e| Error::from_reason(format!("signing failed: {e}")))?;

    // EIP-2 / BIP-146: enforce low-S to prevent signature malleability.
    let (sig, recovery_id) = match sig.normalize_s() {
        Some(normalized) => (
            normalized,
            RecoveryId::from_byte(recovery_id.to_byte() ^ 1)
                .expect("flipped recovery_id must be valid"),
        ),
        None => (sig, recovery_id),
    };

    // Build Ethereum-style 65-byte signature: r | s | v (v = recovery_id + 27)
    let sig_bytes = sig.to_bytes();
    let mut result = [0u8; 65];
    result[..32].copy_from_slice(&sig_bytes[..32]); // r
    result[32..64].copy_from_slice(&sig_bytes[32..]); // s
    result[64] = recovery_id.to_byte() + 27; // v

    Ok(Buffer::from(result.to_vec()))
}
