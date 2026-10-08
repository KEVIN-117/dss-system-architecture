import { AppViewer } from '../../../components/app-viewer';

/** App endpoint for embedding in third-party pages through an iframe. */
export default async function EmbeddedAppPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  return <AppViewer path={path.join('/')} />;
}
