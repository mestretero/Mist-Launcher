use base64::{engine::general_purpose::STANDARD, Engine};
use chacha20poly1305::{
    aead::{Aead, KeyInit},
    XChaCha20Poly1305, XNonce,
};
use rand::rngs::OsRng;
use rand::RngCore;
use x25519_dalek::{PublicKey, StaticSecret};

pub struct KeyPair {
    pub private_key: String, // base64-encoded
    pub public_key: String,  // base64-encoded
}

/// Generate a new X25519 keypair for tunnel encryption.
pub fn generate_keypair() -> KeyPair {
    let secret = StaticSecret::random_from_rng(OsRng);
    let public = PublicKey::from(&secret);
    KeyPair {
        private_key: STANDARD.encode(secret.as_bytes()),
        public_key: STANDARD.encode(public.as_bytes()),
    }
}

/// Derive a shared secret from our private key and peer's public key using X25519.
/// Returns a 32-byte key suitable for XChaCha20-Poly1305.
pub fn derive_shared_secret(my_private_b64: &str, peer_public_b64: &str) -> Result<[u8; 32], String> {
    let my_priv_bytes: [u8; 32] = STANDARD
        .decode(my_private_b64)
        .map_err(|e| format!("Invalid private key: {}", e))?
        .try_into()
        .map_err(|_| "Private key must be 32 bytes".to_string())?;

    let peer_pub_bytes: [u8; 32] = STANDARD
        .decode(peer_public_b64)
        .map_err(|e| format!("Invalid public key: {}", e))?
        .try_into()
        .map_err(|_| "Public key must be 32 bytes".to_string())?;

    let my_secret = StaticSecret::from(my_priv_bytes);
    let peer_public = PublicKey::from(peer_pub_bytes);
    let shared = my_secret.diffie_hellman(&peer_public);

    Ok(*shared.as_bytes())
}

/// Encrypt a packet using XChaCha20-Poly1305 with a random nonce.
/// Returns: [24-byte nonce | ciphertext]
pub fn encrypt_packet(shared_key: &[u8; 32], plaintext: &[u8]) -> Result<Vec<u8>, String> {
    let cipher =
        XChaCha20Poly1305::new_from_slice(shared_key).map_err(|e| format!("Cipher init: {}", e))?;

    let mut nonce_bytes = [0u8; 24];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = XNonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| format!("Encrypt: {}", e))?;

    // Prepend nonce to ciphertext
    let mut out = Vec::with_capacity(24 + ciphertext.len());
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ciphertext);
    Ok(out)
}

/// Decrypt a packet. Input: [24-byte nonce | ciphertext]
pub fn decrypt_packet(shared_key: &[u8; 32], data: &[u8]) -> Result<Vec<u8>, String> {
    if data.len() < 24 {
        return Err("Packet too short".to_string());
    }

    let (nonce_bytes, ciphertext) = data.split_at(24);
    let nonce = XNonce::from_slice(nonce_bytes);

    let cipher =
        XChaCha20Poly1305::new_from_slice(shared_key).map_err(|e| format!("Cipher init: {}", e))?;

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("Decrypt: {}", e))
}
