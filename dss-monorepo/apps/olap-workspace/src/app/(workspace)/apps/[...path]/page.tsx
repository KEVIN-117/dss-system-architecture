import { AppViewer } from '../../../components/app-viewer';

export default async function SavedAppPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  return <AppViewer path={path.join('/')} />;
}
