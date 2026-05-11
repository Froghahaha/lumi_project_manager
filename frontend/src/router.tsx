import { createBrowserRouter, redirect } from 'react-router-dom'
import { getProject, listProjects } from './api'
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/DashboardPage'
import { ProjectPage } from './pages/ProjectPage'
import { ProjectsPage } from './pages/ProjectsPage'

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      {
        path: '/',
        loader: async () => {
          const projects = await listProjects()
          return { projects }
        },
        element: <DashboardPage />,
      },
      {
        path: '/projects',
        loader: async () => {
          const projects = await listProjects()
          return { projects }
        },
        element: <ProjectsPage />,
      },
      {
        path: '/projects/:projectId',
        loader: async ({ params }) => {
          const projectId = params.projectId
          if (!projectId) throw redirect('/projects')
          const project = await getProject(projectId)
          return { project }
        },
        element: <ProjectPage />,
      },
    ],
  },
])
