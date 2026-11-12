import DocView, { docMetadata } from '../../../components/doc-view';

// Restricted guide: rendered per request after the BFF verifies the role.
// Every restricted entry in catalog.ts needs a route like this one.
export const dynamic = 'force-dynamic';

const slug = 'guia-portal-administracion';

export const metadata = docMetadata(slug);

export default function AdminPortalGuidePage() {
  return <DocView slug={slug} expect="restricted" />;
}
