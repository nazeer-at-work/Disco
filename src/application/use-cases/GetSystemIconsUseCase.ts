import { IconRepository } from '../../domain/contracts/IconRepository';
import { SystemIconDescriptor } from '../../domain/entities/SystemIcon';

export class GetSystemIconsUseCase {
  constructor(private readonly iconRepository: IconRepository) {}

  execute(): SystemIconDescriptor[] {
    return this.iconRepository.getSystemIcons();
  }
}
