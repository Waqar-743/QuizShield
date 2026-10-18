import { profilePictureService } from '../services/profilePictureService';

const mockUpload = jest.fn();
const mockSign = jest.fn();
const mockBuckets = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
jest.mock('../config/supabase', () => ({ supabase: {
  storage: { listBuckets: (...args: any[]) => mockBuckets(...args), createBucket: (...args: any[]) => mockCreate(...args),
    from: () => ({ upload: (...args: any[]) => mockUpload(...args), createSignedUrl: (...args: any[]) => mockSign(...args) }) },
  from: () => ({ update: (...args: any[]) => { mockUpdate(...args); return { eq: async () => ({ error: null }) }; } }),
} }));
jest.mock('../config/environment', () => ({ config: { supabaseUrl: 'https://staging.example.test' } }));

const user = '11111111-1111-4111-8111-111111111111';
const key = user + '/abc123.png';
const file = () => ({ mimetype: 'image/png', size: 8,
  buffer: Buffer.from([137,80,78,71,13,10,26,10]) } as Express.Multer.File);
beforeEach(() => {
  jest.clearAllMocks();
  mockBuckets.mockResolvedValue({ data: [{ name: 'profile-pictures', public: false }], error: null });
  mockUpload.mockResolvedValue({ error: null });
  mockSign.mockResolvedValue({ data: { signedUrl: 'https://staging.example.test/private-short-lived-link' }, error: null });
  mockCreate.mockResolvedValue({ error: null });
});

test('uploads use private, unguessable keys without replacing the previous object', async () => {
  const uploaded = await profilePictureService.uploadProfilePicture(user, file());
  expect(uploaded).toMatch(new RegExp('^' + user + '/[a-f0-9]{32}\\.png$'));
  expect(mockUpload).toHaveBeenCalledWith(uploaded, expect.any(Buffer), { contentType: 'image/png', upsert: false });
});
test('a public legacy bucket blocks new uploads until its access is configured', async () => {
  mockBuckets.mockResolvedValueOnce({ data: [{ name: 'profile-pictures', public: true }], error: null });
  await expect(profilePictureService.uploadProfilePicture(user, file())).rejects.toMatchObject({ statusCode: 503 });
  expect(mockUpload).not.toHaveBeenCalled();
});
test('a missing bucket is created private', async () => {
  mockBuckets.mockResolvedValueOnce({ data: [], error: null });
  await profilePictureService.uploadProfilePicture(user, file());
  expect(mockCreate).toHaveBeenCalledWith('profile-pictures', expect.objectContaining({ public: false }));
});
test('file content must match the declared image type', () => {
  expect(() => profilePictureService.validateFile({ ...file(), buffer: Buffer.from('not-an-image') })).toThrow('file content');
});
test('an owned stored key gets a one-hour signed link', async () => {
  expect(await profilePictureService.signedProfilePictureUrl(key, user)).toContain('private-short-lived-link');
  expect(mockSign).toHaveBeenCalledWith(key, 3600);
});
test('legacy links are normalized only for the configured storage origin and owner', async () => {
  await profilePictureService.signedProfilePictureUrl('https://staging.example.test/storage/v1/object/public/profile-pictures/' + key, user);
  expect(mockSign).toHaveBeenCalledWith(key, 3600);
  mockSign.mockClear();
  expect(await profilePictureService.signedProfilePictureUrl('https://foreign.example.test/storage/v1/object/public/profile-pictures/' + key, user)).toBeUndefined();
  expect(await profilePictureService.signedProfilePictureUrl(key, '22222222-2222-4222-8222-222222222222')).toBeUndefined();
  expect(await profilePictureService.signedProfilePictureUrl(user + '/../private.png', user)).toBeUndefined();
  expect(mockSign).not.toHaveBeenCalled();
});
test('metadata accepts an owned key, never a foreign reference', async () => {
  await profilePictureService.saveProfilePictureUrl(user, key);
  expect(mockUpdate).toHaveBeenCalledWith({ profile_picture_url: key });
  await expect(profilePictureService.saveProfilePictureUrl(user, 'https://foreign.example.test/photo.png')).rejects.toMatchObject({ statusCode: 400 });
});
test('profile service exposes no biometric enrolment method',()=>{
 expect(profilePictureService).not.toHaveProperty('saveFaceEncoding');
});
