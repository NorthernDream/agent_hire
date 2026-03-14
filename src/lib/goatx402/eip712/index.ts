import { ethers } from 'ethers'
import type { CalldataSignRequest, EIP712Domain, EIP712Type } from '../types.js'

export async function signTypedData(
  signer: ethers.Signer,
  signRequest: CalldataSignRequest
): Promise<string> {
  const { EIP712Domain, ...types } = signRequest.types
  void EIP712Domain
  return signer.signTypedData(signRequest.domain, types, signRequest.message)
}

export function hashCalldata(calldata: string): string {
  return ethers.keccak256(calldata)
}

export function verifySignature(
  signRequest: CalldataSignRequest,
  signature: string,
  expectedSigner: string
): boolean {
  try {
    const { EIP712Domain, ...types } = signRequest.types
    void EIP712Domain
    const recovered = ethers.verifyTypedData(signRequest.domain, types, signRequest.message, signature)
    return recovered.toLowerCase() === expectedSigner.toLowerCase()
  } catch {
    return false
  }
}

export function buildDomainSeparator(domain: EIP712Domain): string {
  return ethers.TypedDataEncoder.hashDomain(domain)
}

export type { CalldataSignRequest, EIP712Domain, EIP712Type }
