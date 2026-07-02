import { supabaseConfig } from '../../config/supabase';
import { FeedbackMode } from '../../presentation/screens/IconGalleryScreen.types';
import { getFeedbackDeviceId } from '../native/LauncherBridge';
import { HomeLauncherDetails, LaunchableApp } from '../native/LauncherBridge';

// Identifies which icon-pack app this submission came from. All packs write to
// the same shared Supabase project; the `pack` field lands in the `pack` column.
const PACK = 'disco';

type IconFeedbackPayload = {
  type: FeedbackMode;
  selectedApps: LaunchableApp[];
  launcherDetails: {
    currentHomeLauncher: HomeLauncherDetails | null;
  };
  submittedAt: string;
};

type SubmitFeedbackResponse = {
  ok: boolean;
  submissionId?: string;
  error?: string;
};

async function postToSupabaseFunction(
  body: unknown,
  deviceId: string,
): Promise<SubmitFeedbackResponse> {
  const base = supabaseConfig.baseUrl.replace(/\/+$/, '');
  const path = supabaseConfig.feedbackFunctionPath.replace(/^\/+/, '');
  const response = await fetch(`${base}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseConfig.apiKey,
      Authorization: `Bearer ${supabaseConfig.apiKey}`,
      'x-device-id': deviceId,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Supabase function call failed (${response.status}): ${details}`,
    );
  }

  return response.json() as Promise<SubmitFeedbackResponse>;
}

export async function submitIconFeedback(
  payload: IconFeedbackPayload,
): Promise<string> {
  const deviceId = await getFeedbackDeviceId();
  const response = await postToSupabaseFunction(
    { ...payload, pack: PACK },
    deviceId,
  );
  const submissionId = response.submissionId;
  if (!submissionId) {
    throw new Error('Supabase function succeeded but submission id is missing.');
  }

  return submissionId;
}
