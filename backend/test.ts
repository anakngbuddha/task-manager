import { projectService } from './src/services/project.service.js';

async function test() {
  try {
    const projects = await projectService.getAllForUser('cm1234567890');
    console.log('getAllForUser Success:', projects.length);
    const dashboard = await projectService.getDashboardForUser('cm1234567890');
    console.log('getDashboardForUser Success:', dashboard.totalProjects);
  } catch (err) {
    console.error('ERROR OCCURRED:');
    console.error(err);
  }
}

test();
