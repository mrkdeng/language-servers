import { standalone } from '@aws/language-server-runtimes/runtimes'
import { RuntimeProps } from '@aws/language-server-runtimes/runtimes/runtime'
import { IdentityServer } from '@aws/aws-lsp-identity'

const props: RuntimeProps = {
    version: '0.1.0',
    servers: [IdentityServer],
    name: 'Identity Server',
}

standalone(props)