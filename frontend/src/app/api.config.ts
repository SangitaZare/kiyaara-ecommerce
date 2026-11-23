import { environment } from '../environments/environment';

// One place for the API address, built from the environment file:
//   ng serve / development build  -> environments/environment.ts       (https://localhost:7001)
//   production build (ng build)   -> environments/environment.prod.ts  (your deployed API)
// angular.json swaps the files for production, so a deployed site never calls localhost.
export const API_BASE_URL = `${environment.apiOrigin}/api`;
