import { createBrowserRouter, redirect } from 'react-router-dom'
import {
  getIssue,
  getProject,
  listAttachments,
  listComments,
  listIssueAudit,
  listIssues,
  listProjectTimelineEvents,
  listProjects,
  listSubTasks,
} from './api'
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/DashboardPage'
import { IssuePage } from './pages/IssuePage'
import { MeetingPage } from './pages/MeetingPage'
import { ProjectPage } from './pages/ProjectPage'

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
        loader: async () => redirect('/'),
      },
      {
        path: '/meeting',
        loader: async () => {
          const projects = await listProjects()
          return { projects }
        },
        element: <MeetingPage />,
      },
      {
        path: '/projects/:projectId',
        loader: async ({ params }) => {
          const projectId = params.projectId
          if (!projectId) throw redirect('/projects')
          const [project, subtasks, issues, timelineEvents] = await Promise.all([
            getProject(projectId),
            listSubTasks(projectId),
            listIssues({ project_id: projectId }),
            listProjectTimelineEvents(projectId),
          ])
          return { project, subtasks, issues, timelineEvents }
        },
        element: <ProjectPage />,
      },
      {
        path: '/projects/:projectId/board',
        loader: async ({ params }) => {
          const projectId = params.projectId
          if (!projectId) throw redirect('/projects')
          throw redirect(`/projects/${projectId}`)
        },
      },
      {
        path: '/issues/:issueId',
        loader: async ({ params }) => {
          const issueId = params.issueId
          if (!issueId) throw redirect('/projects')
          const [issue, audit, comments, attachments] = await Promise.all([
            getIssue(issueId),
            listIssueAudit(issueId),
            listComments(issueId),
            listAttachments(issueId),
          ])
          return { issue, audit, comments, attachments }
        },
        element: <IssuePage />,
      },
      {
        path: '*',
        loader: async () => redirect('/'),
      },
    ],
  },
])
