import type { Metadata } from 'next';
import DocView, { docMetadata } from '../../../components/doc-view';
import { docs } from '../../../content/catalog';

// Public guides only, all prerendered. Restricted guides live in their own
// dynamic routes (see ../guia-portal-administracion) so the session check
// never runs inside a static render.
export const dynamicParams = false;

export function generateStaticParams() {
  return docs.filter((doc) => doc.classification !== 'restricted').map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return docMetadata((await params).slug);
}

export default async function DocumentationPage({ params }: { params: Promise<{ slug: string }> }) {
  return <DocView slug={(await params).slug} expect="public" />;
}
