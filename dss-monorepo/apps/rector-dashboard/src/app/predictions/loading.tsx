import { Loader } from '@dss-monorepo/design-system';

export default function LoadingPredictions() {
  return <Loader text="Cargando predicciones…" fullScreen={false} className="mx-auto w-full max-w-7xl rounded-xl" />;
}
