import { SystemIconDescriptor } from '../entities/SystemIcon';

export interface IconRepository {
  getSystemIcons(): SystemIconDescriptor[];
}
