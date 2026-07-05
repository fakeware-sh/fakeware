export default defineNuxtConfig({
  extends: ['docus'],
  modules: ['@nuxtjs/sitemap'],
  site: {
    name: 'Fakeware',
    url: 'https://fakeware.sh',
  },
  sitemap: {
    sources: ['/__sitemap__/content'],
  },
  llms: {
    domain: 'https://fakeware.sh',
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
