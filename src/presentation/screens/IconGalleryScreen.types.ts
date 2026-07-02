import { GetSystemIconsUseCase } from '../../application/use-cases/GetSystemIconsUseCase';

export type IconGalleryScreenProps = {
  getSystemIconsUseCase: GetSystemIconsUseCase;
};

export type TabIconProps = {
  active: boolean;
};

export type CheckSquareIconProps = {
  checked: boolean;
};

export type FeedbackMode = 'request';
