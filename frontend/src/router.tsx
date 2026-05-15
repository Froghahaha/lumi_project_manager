import { createBrowserRouter, Navigate, redirect } from 'react-router-dom'
import { getProject, listProjects } from './api'
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { ProjectPage } from './pages/ProjectPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { WorkspacePage } from './pages/workspaces/WorkspacePage'

function isLoggedIn() {
  try {
    const raw = localStorage.getItem('lumi_auth')
    if (raw) {
      const data = JSON.parse(raw)
      return !!data.person && !!data.token
    }
  } catch { /* ignore */ }
  return false
}

function requireAuth() {
  if (!isLoggedIn()) {
    throw redirect('/login')
  }
  return null
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    loader: () => {
      if (isLoggedIn()) {
        throw redirect('/workspace')
      }
      throw redirect('/login')
    },
  },
  {
    id: 'app',
    element: <Layout />,
    loader: requireAuth,
    children: [
      {
        path: '/workspace',
        element: <WorkspacePage />,
      },
      {
        path: '/dashboard',
        element: <DashboardPage />,
      },
      {
        path: '/projects',
        loader: async () => {
          requireAuth()
          const projects = await listProjects()
          return { projects }
        },
        element: <ProjectsPage />,
      },
      {
        path: '/projects/:projectId',
        loader: async ({ params }) => {
          requireAuth()
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
