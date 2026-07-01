export default defineNuxtConfig({
  extends: ['docus'],
  site: {
    name: 'Fakeware',
  },
  content: {
    database: {
      type: 'nodesqlite',
    },
  },
  app: {
    head: {
      link: [{ rel: 'icon', type: 'image/png', sizes: '96x96', href: '/favicon-96x96.png' }],
    },
  },
})
