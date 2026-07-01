export default defineAppConfig({
  ui: {
    colors: {
      primary: 'indigo',
      neutral: 'neutral',
    },
  },
  seo: {
    title: 'Fakeware',
    titleTemplate: '%s · Fakeware',
    description:
      'Fill your Shopware shop with realistic demo data from typed, deterministic definitions.',
  },
  header: {
    title: 'Fakeware',
  },
  socials: {
    github: 'https://github.com/fakeware-sh/fakeware',
  },
  github: {
    url: 'https://github.com/fakeware-sh/fakeware',
    branch: 'main',
    rootDir: 'docs',
  },
  search: {
    fts: true,
  },
  navigation: {
    sub: 'header',
  },
  toc: {
    title: 'On this page',
    bottom: {
      title: 'Community',
      links: [
        {
          icon: 'i-simple-icons-github',
          label: 'Star on GitHub',
          to: 'https://github.com/fakeware-sh/fakeware',
          target: '_blank',
        },
        {
          icon: 'i-lucide-circle-alert',
          label: 'Report an issue',
          to: 'https://github.com/fakeware-sh/fakeware/issues',
          target: '_blank',
        },
      ],
    },
  },
})
