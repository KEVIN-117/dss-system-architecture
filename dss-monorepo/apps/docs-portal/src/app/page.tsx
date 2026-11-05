import { getApiCatalog } from '../lib/api-catalog';
import Workbench from './workbench';

export default function Page() {
  return <Workbench apiCatalog={getApiCatalog()} />;
}
