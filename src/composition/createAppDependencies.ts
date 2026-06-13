import { GetSystemIconsUseCase } from '../application/use-cases/GetSystemIconsUseCase';
import { InMemoryIconRepository } from '../infrastructure/repositories/InMemoryIconRepository';

export function createAppDependencies() {
  const iconRepository = new InMemoryIconRepository();
  const getSystemIconsUseCase = new GetSystemIconsUseCase(iconRepository);

  return {
    getSystemIconsUseCase,
  };
}
