import { IconRepository } from '../../domain/contracts/IconRepository';
import { SystemIconDescriptor } from '../../domain/entities/SystemIcon';
import systemIcons from '../../config/system-icons.generated.json';

export class InMemoryIconRepository implements IconRepository {
  getSystemIcons(): SystemIconDescriptor[] {
    return systemIcons as SystemIconDescriptor[];
  }
}
