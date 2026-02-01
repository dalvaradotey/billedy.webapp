// Tipos - safe for client
export * from './types';

// Schemas - safe for client (solo usa zod)
export * from './schemas';

// Server-only exports (queries y actions usan la BD)
// Importar directamente desde './queries' o './actions' en server components
export {
  getProjects,
  getActiveProjects,
  getProjectById,
  getLatestProject,
  getCurrencies,
} from './queries';

export {
  createProject,
  updateProject,
  archiveProject,
  restoreProject,
  getCurrentProjectId,
  setCurrentProjectId,
} from './actions';

// Components - client components
export { ProjectSelector } from './components';
