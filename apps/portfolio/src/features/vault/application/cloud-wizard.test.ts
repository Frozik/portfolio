import { aDevice, TEST_FOLDER } from './fake-device.test-helper';

function aCloud() {
  return aDevice().startStore().cloud;
}

async function checkedFolder() {
  const cloud = aCloud();
  cloud.openWebDavForm();
  cloud.webDavForm?.setEndpoint(TEST_FOLDER);
  cloud.webDavForm?.setUsername('me');
  cloud.webDavForm?.setPassword('app-password');
  await cloud.webDavForm?.runCheck();
  return cloud;
}

describe('the cloud wizard', () => {
  it('starts by choosing a cloud', () => {
    expect(aCloud().step).toEqual({ kind: 'choose' });
  });

  it('shows only the chosen cloud: choosing the other one leaves the first', () => {
    const cloud = aCloud();

    cloud.openWebDavForm();
    expect(cloud.step).toMatchObject({ kind: 'connect', cloud: { kind: 'webdav' } });

    cloud.openDriveForm();
    expect(cloud.step).toMatchObject({ kind: 'connect', cloud: { kind: 'drive' } });
    expect(cloud.webDavForm).toBeNull();
  });

  it('moves on to the vaults only once the folder is reached', async () => {
    const cloud = await checkedFolder();

    expect(cloud.step).toMatchObject({ kind: 'pick', cloud: { kind: 'webdav' } });
  });

  it('goes back a step at a time, keeping what was typed', async () => {
    const cloud = await checkedFolder();

    cloud.back();
    expect(cloud.step).toMatchObject({ kind: 'connect', cloud: { kind: 'webdav' } });
    expect(cloud.webDavForm?.username).toBe('me');

    cloud.back();
    expect(cloud.step).toEqual({ kind: 'choose' });
  });
});
