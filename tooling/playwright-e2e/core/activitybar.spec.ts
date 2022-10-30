import { expect } from '@playwright/test';

import { PRIMARY_EDITOR_INDEX } from '@bangle.io/constants';

import { withBangle as test } from '../fixture-with-bangle';
import {
  getEditorDebugString,
  getPrimaryEditorDebugString,
  isDarwin,
  SELECTOR_TIMEOUT,
} from '../helpers';

test.beforeEach(async ({ bangleApp }, testInfo) => {
  await bangleApp.open();
});

test('lists options', async ({ page }) => {
  await page.click('button[aria-label="options menu"]');

  let optionsHandle = await page.$('[aria-label^="options dropdown"]');
  expect(Boolean(optionsHandle)).toBe(true);

  expect(
    JSON.stringify(
      (
        await page
          .locator('[aria-label="options dropdown"] li[data-key]')
          .allInnerTexts()
      ).map((r) => r.split('⌘').join('Ctrl')),
    ),
  ).toEqual(
    JSON.stringify([
      'New note',
      'New workspace',
      isDarwin ? 'Switch workspace\nCtrlR' : 'Switch workspace\nCtrlH',
      'Switch Dark/Light theme',
      'Notes palette\nCtrlP',
      'Operation palette\nCtrl⇧P',
      'Whats new',
      'Report issue',
      'Twitter',
      'Discord',
    ]),
  );
});

test.describe('mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 960 });
  });

  test('lists options in mobile', async ({ page }) => {
    await page.click('button[aria-label="options menu"]');

    let optionsHandle = await page.$('[aria-label^="options dropdown"]');
    expect(Boolean(optionsHandle)).toBe(true);

    expect(
      JSON.stringify(
        await page
          .locator('[aria-label="options dropdown"] li[data-key]')
          .allInnerTexts(),
      ),
    ).toEqual(
      JSON.stringify([
        'New note',
        'New workspace',
        'Switch workspace',
        'Note browser',
        'Search notes',
        'Switch Dark/Light theme',
        'Notes palette',
        'Operation palette',
        'Whats new',
        'Report issue',
        'Twitter',
        'Discord',
      ]),
    );
  });

  test('clicking on Note browser works', async ({ page }) => {
    await page.click('button[aria-label="options menu"]');

    await page.locator('[aria-label="Note browser"]').click();

    await expect(
      page.locator('.B-workspace-sidebar_workspace-sidebar '),
    ).toContainText('Note browser');

    await page.locator('[aria-label="hide Note browser"]').click();

    await expect
      .poll(() => getPrimaryEditorDebugString(page))
      .toContain('Hello');
  });

  test('edit button', async ({ page }) => {
    let activityBar = page.locator('.B-ui-dhancha_activitybar');

    await activityBar.waitFor();
    // by default on chrome editing is enabled
    const done = activityBar.locator('role=button[name="done editing"]');

    await test.step('clicking on done works', async () => {
      await expect(done).toContainText('done');
      await done.click();
    });

    const edit = activityBar.locator('role=button[name="edit"]');

    await test.step('clicking edit should make the document typables', async () => {
      await expect(edit).toContainText('edit');

      await edit.click();
      await done.waitFor();

      // clicking edit should focus editor
      await page.keyboard.type('manthanoy', { delay: 30 });

      let primaryText = await getEditorDebugString(page, PRIMARY_EDITOR_INDEX);
      expect(primaryText).toMatch(/manthanoy/);
    });

    await test.step('clicking done should prevent any editing', async () => {
      await done.click();
      await edit.waitFor();

      await page.keyboard.type('sugar', { delay: 30 });

      let primaryText = await getEditorDebugString(page, PRIMARY_EDITOR_INDEX);
      expect(primaryText.includes('sugar')).toBe(false);
    });
  });
});

test('clicking on new workspace', async ({ page }) => {
  await page.click('button[aria-label="options menu"]');

  await page.click(
    '[aria-label="options dropdown"] li[data-key="NewWorkspace"]',
  );

  await page.waitForSelector('.B-ui-components_dialog-content-container', {
    timeout: SELECTOR_TIMEOUT,
  });
  expect(Boolean(await page.$('text=Choose a storage type'))).toBe(true);
});
