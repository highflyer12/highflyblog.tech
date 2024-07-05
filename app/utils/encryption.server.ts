//
import crypto from 'crypto'
import { getRequiredServerEnvVar } from './misc.tsx'

const algorithm = 'aes-256-gcm' // AES加密是对称加密的一种，即加密和解密使用相同的一把密钥【用来加密明文、解密密文的密码，就是下文的ENCRYPTION_KEY】，这里256表示密钥长度；AES是一种分组加密技术，分组加密就是把明文分成一组一组的，每组长度相等，每次加密一组数据，直到加密完整个明文。

const secret = getRequiredServerEnvVar('MAGIC_LINK_SECRET')
const ENCRYPTION_KEY = crypto.scryptSync(secret, 'salt', 32)
const IV_LENGTH = 12
const UTF8 = 'utf8'
const HEX = 'hex'

export function encrypt(text: string) {
	const iv = crypto.randomBytes(IV_LENGTH) // a random initialization vector (iv) of length IV_LENGTH (12 bytes). Used to ensure that even if the same plaintext【未经加密的数据】is encrypted multiple times, the resulting ciphertext【经过加密的数据】 will be different.初始向量(IV，Initialization Vector)：它的作用和MD5的“加盐”有些类似，目的是防止同样的明文块，始终加密成同样的密文块
	const cipher = crypto.createCipheriv(algorithm, ENCRYPTION_KEY, iv)
	let encrypted = cipher.update(text, UTF8, HEX) // Cipher.update(data: string, inputEncoding: Encoding | undefined, outputEncoding: Encoding)
	encrypted += cipher.final(HEX)
	const authTag = cipher.getAuthTag() // "authentication tag". Used to verify the integrity of the data and the authenticity of its origin when the data is decrypted.
	return `${iv.toString(HEX)}:${authTag.toString(HEX)}:${encrypted}`
}

export function decrypt(text: string) {
	const [ivPart, authTagPart, encryptedText] = text.split(':')
	if (!ivPart || !authTagPart || !encryptedText) {
		throw new Error('Invalid text.')
	}

	const iv = Buffer.from(ivPart, HEX)
	const authTag = Buffer.from(authTagPart, HEX)
	const decipher = crypto.createDecipheriv(algorithm, ENCRYPTION_KEY, iv)
	decipher.setAuthTag(authTag)
	let decrypted = decipher.update(encryptedText, HEX, UTF8)
	decrypted += decipher.final(UTF8)
	return decrypted
}
