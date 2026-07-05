export default defineSitemapEventHandler(async (event) => {
  const pages = await queryCollection(event, 'docs').select('path').all()

  return pages
    .filter((page) => page.path && !page.path.split('/').some((segment) => segment.startsWith('.')))
    .map((page) => ({ loc: page.path }))
})
