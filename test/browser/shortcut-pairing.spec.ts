import { expect, test } from '@playwright/test'

const localUrl = (value: string) => {
  const url = new URL(value)
  url.hostname = '127.0.0.1'
  return url.href
}

// The shortcut-pairing project runs against a separate opt-in server.
for (const width of [390, 1280]) {
  test(`connect, import and revoke a shortcut at ${width}px`, async ({ page, context, baseURL }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await context.route('**/*', (route) => {
      if (new URL(route.request().url()).origin === new URL(baseURL!).origin) return route.continue()
      return route.abort()
    })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/share')
    await expect(page.getByRole('heading', { name: 'Save to Sizzle', exact: true })).toBeVisible()

    const name = `Test phone ${width} ${Date.now()}`
    await page.getByLabel('Connection name').fill(name)
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('link', { name: 'Add “Save to Sizzle”' }).click()
    expect((await downloadPromise).suggestedFilename()).toBe('Save to Sizzle.shortcut')
    await page.getByRole('button', { name: 'Connect shortcut', exact: true }).click()
    const open = page.getByRole('link', { name: 'Open Shortcuts to connect' })
    await expect(open).toBeVisible()
    const url = new URL((await open.getAttribute('href'))!)
    expect(url.protocol).toBe('shortcuts:')
    const setup = JSON.parse(url.searchParams.get('text')!)
    // The local HTTP request emulates only the shortcut's transport, not iOS.
    const pairing = await context.request.post(localUrl(setup.pairing_url), {
      data: { pairing_token: setup.pairing_token },
    })
    expect(pairing.status()).toBe(201)
    const connection = await pairing.json()
    const headers = { Authorization: `Bearer ${connection.token}` }
    const imported = await context.request.post(localUrl(connection.endpoint), {
      headers,
      data: { text: 'Shortcut test recipe\n2 cups flour\nMix and bake.' },
    })
    expect(imported.status()).toBe(202)
    expect((await imported.json()).status).toBe('queued')

    await page.getByRole('button', { name: 'Check connection', exact: true }).click()
    const row = page.getByRole('listitem').filter({ has: page.getByText(name, { exact: true }) })
    await expect(row.getByText('Connected', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    // Do not capture the single-use link, even after redemption.
    await page.reload()
    await page.screenshot({ path: testInfo.outputPath(`shortcut-${width}.png`), fullPage: true })
    await row.getByRole('button', { name: 'Disconnect', exact: true }).click()
    await expect(row).toHaveCount(0)
    const rejected = await context.request.post(localUrl(connection.endpoint), { headers, data: { text: 'Recipe' } })
    expect(rejected.status()).toBe(401)
    expect(errors).toEqual([])
  })
}
