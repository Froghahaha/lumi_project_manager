import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'

export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      componentSize="large"
      theme={{
        token: {
          fontSize: 16,
          controlHeight: 40,
          controlHeightLG: 44,
        },
        components: {
          Card: {
            headerFontSize: 20,
            headerFontSizeSM: 18,
            headerHeight: 56,
            headerHeightSM: 48,
          },
        },
      }}
    >
      <RouterProvider router={router} />
    </ConfigProvider>
  )
}
