import { AwsErrorCodes, SsoSession } from '@aws/language-server-runtimes/server-interface'
import { AwsError } from '../awsError'
import { CreateTokenCommandOutput, SSOOIDC } from '@aws-sdk/client-sso-oidc'
import { SsoClientRegistration } from './cache'
import { SSOToken } from '@smithy/shared-ini-file-loader'

export function getSsoOidc(ssoRegion: string): SSOOIDC & Disposable {
    const oidc = new SSOOIDC({ region: ssoRegion })
    return (
        Object.hasOwn(oidc, Symbol.dispose) ? oidc : Object.assign(oidc, { [Symbol.dispose]: () => oidc.destroy() })
    ) as SSOOIDC & Disposable
}

export function throwOnInvalidClientName(clientName?: string): asserts clientName is string {
    if (!clientName?.trim().length) {
        throw new AwsError(`Client name [${clientName}] is invalid.`, AwsErrorCodes.E_INVALID_SSO_CLIENT)
    }
}

export function throwOnInvalidClientRegistration(
    clientRegistration?: SsoClientRegistration
): asserts clientRegistration is SsoClientRegistration & { clientId: string; clientSecret: string; expiresAt: string } {
    if (
        !clientRegistration ||
        !clientRegistration.clientId ||
        !clientRegistration.clientSecret ||
        !clientRegistration.expiresAt ||
        !clientRegistration.scopes ||
        !clientRegistration.scopes.length
    ) {
        throw new AwsError(
            `Client registration [${clientRegistration?.clientId}] is invalid.`,
            AwsErrorCodes.E_INVALID_SSO_CLIENT
        )
    }
}

export function throwOnInvalidSsoSession(
    ssoSession?: SsoSession
): asserts ssoSession is SsoSession & { name: string; settings: { sso_region: string; sso_start_url: string } } {
    if (
        !ssoSession ||
        !ssoSession.name ||
        !ssoSession.settings ||
        !ssoSession.settings.sso_region ||
        !ssoSession.settings.sso_start_url
    ) {
        throw new AwsError(`SSO session [${ssoSession?.name}] is invalid.`, AwsErrorCodes.E_INVALID_SSO_SESSION)
    }
}

// A convenience function to reduce the amount of code need for one-liner try/catch blocks as well
// as make declarations of consts for results of a call that must occur inside a try block.
export async function tryAsync<R, E extends Error>(tryIt: () => Promise<R>, catchIt: (error: Error) => E): Promise<R> {
    try {
        return await tryIt()
    } catch (error) {
        throw catchIt(error instanceof Error ? error : new Error(error?.toString() ?? 'Unknown error'))
    }
}

export function UpdateSsoTokenFromCreateToken(
    output: CreateTokenCommandOutput,
    clientRegistration: SsoClientRegistration,
    ssoSession: SsoSession,
    ssoToken?: SSOToken
): SSOToken {
    throwOnInvalidClientRegistration(clientRegistration)
    throwOnInvalidSsoSession(ssoSession)

    if (!output.accessToken || !output.expiresIn) {
        throw new AwsError('CreateToken returned invalid result.', AwsErrorCodes.E_CANNOT_CREATE_SSO_TOKEN)
    }

    if (!ssoToken) {
        ssoToken = {} as unknown as SSOToken
    }

    // Update SSO token with latest client registration and refreshed SSO token
    // https://docs.aws.amazon.com/singlesignon/latest/OIDCAPIReference/API_CreateToken.html#API_CreateToken_ResponseElements
    ssoToken.accessToken = output.accessToken
    ssoToken.clientId = clientRegistration.clientId
    ssoToken.clientSecret = clientRegistration.clientSecret
    ssoToken.expiresAt = new Date(Date.now() + output.expiresIn * 1000).toISOString()
    ssoToken.refreshToken = output.refreshToken
    ssoToken.region = ssoSession.settings.sso_region
    ssoToken.registrationExpiresAt = clientRegistration.expiresAt
    ssoToken.startUrl = ssoSession.settings.sso_start_url

    return ssoToken
}