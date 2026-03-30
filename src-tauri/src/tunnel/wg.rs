use base64::{engine::general_purpose::STANDARD, Engine};
use x25519_dalek::{PublicKey, StaticSecret};
use rand::rngs::OsRng;

pub struct KeyPair {
    pub private_key: String,
    pub public_key: String,
}

pub fn generate_keypair() -> KeyPair {
    let secret = StaticSecret::random_from_rng(OsRng);
    let public = PublicKey::from(&secret);
    KeyPair {
        private_key: STANDARD.encode(secret.as_bytes()),
        public_key: STANDARD.encode(public.as_bytes()),
    }
}
