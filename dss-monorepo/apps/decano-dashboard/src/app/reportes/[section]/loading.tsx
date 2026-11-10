import { Loader } from '@dss-monorepo/design-system';

export default function LoadingReport() {
  return <Loader text="Cargando reporte de facultad…" fullScreen={false} className="mx-auto w-full max-w-7xl rounded-xl" />;
}
