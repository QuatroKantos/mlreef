import uuidv1 from 'uuid/v1';
import store from 'store';
import * as types from 'actions/actionTypes';
import MLRAuthApi from 'apis/MLAuthApi';
import CodeProjectPublishingApi from './apiMocks/CodeProjectPublishing.spike.ts';
import CommitsApiMock from './apiMocks/CommitMocks.spike.ts';
import ProjectApiMockSpike from './apiMocks/ProjectApiMock.spike.ts';
import UserApi from './apiMocks/UserApi.ts';

const api = new CodeProjectPublishingApi();
const userApi = new UserApi();
const authApi = new MLRAuthApi();
const projectApi = new ProjectApiMockSpike();
const commitsApiMock = new CommitsApiMock();

// TODO: this part is necessary to supply the API mocks with credentials
// As the apiMocks are removed from this test, these lines can also be removed
// eslint-disable-next-line camelcase
let removeMe_user;
// eslint-disable-next-line camelcase
let removeMe_email;
// eslint-disable-next-line camelcase
let removeMe_pass;
// end todo

beforeAll(async () => {
  // ------------- create the user ------------- //
  const suffix = uuidv1().toString().split('-')[0];
  const username = `TEST-CodeProjectPublishing.${suffix}`;
  const password = 'password';
  const email = `TEST-Node.${suffix}@example.com`;
  const registerData = {
    username,
    email,
    password,
    name: username,
  };
  const registerResponse = await userApi.register(registerData);
  expect(registerResponse.ok).toBeTruthy();

  // ----------- login with newly create user ----------- //
  console.log('Running end2end tests against localhost:80 -> expecting proxy to redirect to $INSTANCE_HOST');
  if (!store.getState().user.isAuth) {
    await authApi.login(username, email, password)
      .then((user) => store.dispatch({ type: types.LOGIN, user }));
  }

  // TODO: this part is necessary to supply the API mocks with credentials
  // As the apiMocks are removed from this test, these lines can also be removed
  // eslint-disable-next-line camelcase
  removeMe_user = username;
  // eslint-disable-next-line camelcase
  removeMe_email = email;
  // eslint-disable-next-line camelcase
  removeMe_pass = password;
  // end todo
});

test('Can create new user, new code project, commit file and publish code project', async () => {
  jest.setTimeout(30000);
  //
  // ----------- login with the user ----------- //
  // TODO: this part is necessary to supply the API mocks with credentials
  // As the apiMocks are removed from this test, these lines can also be removed
  // eslint-disable-next-line camelcase
  const loginData = {
    username: removeMe_user,
    email: removeMe_email,
    password: removeMe_pass,
  };
  const loginResp = await userApi.login(loginData);
  expect(loginResp.ok).toBe(true);
  const resgistrationBody = await loginResp.json();
  expect(resgistrationBody.access_token).toBeDefined();

  const headers = {
    'Content-type': 'Application/json',
    'PRIVATE-TOKEN': `Bearer ${resgistrationBody.access_token}`,
    Authorization: `Bearer ${resgistrationBody.access_token}`,
  };

  //
  // ----------- create a new project ----------- //
  //
  const body = JSON.stringify({
    name: 'Can publish code project',
    slug: 'can-publish-code-project',
    namespace: '',
    initialize_with_readme: true,
    description: '',
    visibility: 'public',
    input_data_types: [],
  });
  const projectCreationResp = await projectApi.create(headers, body);
  const creationProjRespBody = await projectCreationResp.json();
  expect(projectCreationResp.ok).toBeTruthy();

  const { id: projectId, gitlab_id: gid } = creationProjRespBody;

  //
  // -------- Commit the project recently created -------- //
  //
  const commitResp = await commitsApiMock.performCommit(
    gid,
    'README.md',
    // eslint-disable-next-line camelcase
    `File committed by ${removeMe_user}`,
    'master',
    'some message',
    'update',
    'text',
    headers,
  );

  expect(commitResp.ok).toBeTruthy();

  //
  // -------- Commit the project recently created -------- //
  //
  const commitDataProcessorResp = await commitsApiMock.performCommit(
      gid,
      'dataproc.py',
      // eslint-disable-next-line camelcase
      `
@data_processor(
    name="Resnet 2.0 Filter",
    author="MLReef",
    type="ALGORITHM",
    description="Transforms images with lots of magic",
    visibility="PUBLIC",
    input_type="IMAGE",
    output_type="IMAGE"
)
@parameter(name="cropFactor", type="Float", required=True, defaultValue=1)
@parameter(name="imageFiles", type="List",required=True, defaultValue="[]")
@parameter(name="optionalFilterParam", type="Integer", required=True, defaultValue=1)
def myCustomOperationEntrypoint(cropFactor, imageFiles, optionalFilterParam=1):
    print("stuff happening here")
    # output is not exported via return, but rather as Files.
    # we have to provide a way to store and chain outputs to the next input

myCustomOperationEntrypoint(epfInputArray)`,
      'master',
      'Data processor',
      'create',
      'text',
      headers,
  );

  expect(commitDataProcessorResp.ok).toBeTruthy();

  //
  // -------- Publish the Project -------- //
  //
  const publishingRes = await api.publish(
    headers,
    projectId,
    null
  );

  console.log('################### Publishing Response');
  console.log(publishingRes);
  console.log('################### Publishing Response Body');
  console.log(await publishingRes.json());
  expect(publishingRes.ok).toBeTruthy();

  //
  // -------- Verify Publishing status -------- //
  //
  console.log('################### Get Project');
  const projectReadResponse = await projectApi.get(headers, projectId);
  expect(projectReadResponse.ok).toBeTruthy();
  console.log('################### Print Json Response');
  const projectBody = await projectReadResponse.json()
  console.log(projectBody);
  console.log('################### Assert dataOperation exists');
  /* { id: '723076c6-eee5-11ea-adc1-0242ac120002',
        slug: 'commons-txt-ops',
        url: 'http://ec2-18-157-161-187.eu-central-1.compute.amazonaws.com:10080/mlreef/commons-txt-ops',
        owner_id: 'aaaa0000-0001-0000-0000-cccccccccccc',
        name: 'Text processing operations',
        gitlab_namespace: 'mlreef',
        gitlab_path: 'commons-txt-ops',
        gitlab_id: 1,
        visibility_scope: 'PUBLIC',
        description:         'Removes numbers,tokenization,numbers to words, filter words.',
        tags: [],
        stars_count: 0,
        forks_count: 0,
        input_data_types: [ 'IMAGE' ],
        output_data_types: [ 'IMAGE' ],
        searchable_type: 'CODE_PROJECT',
        data_processor:
         { id: '72307a68-eee5-11ea-adc1-0242ac120002',
           slug: 'commons-txt-ops',
           name: 'Text processing operations',
           input_data_type: 'TEXT',
           output_data_type: 'TEXT',
           type: 'OPERATION',
           visibility_scope: 'PUBLIC',
           description:
            'Removes numbers,tokenization,numbers to words, filter words.',
           code_project_id: '723076c6-eee5-11ea-adc1-0242ac120002',
           author_id: 'aaaa0000-0001-0000-0000-cccccccccccc' } },
   */

  expect(projectBody.name !== undefined).toBeTruthy();
  // TODO: make the following line work
  // expect(projectBody.data_processor !== undefined).toBeTruthy();



  //
  // -------- Remove project at the end of the test -------- //
  //  At least removing the project automatically we do not fill the database of garbage
  //
  // const projDeletionResp = await projectApi.delete(projectId, headers);
  // expect(projDeletionResp.ok).toBeTruthy();
});
