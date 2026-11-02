import {expect} from '@playwright/test';
/** Existing one-shot journeys explicitly opt out of the new continuous-entry default. */
export async function closeAfterMaterialSave(page){
 await page.locator('.sidebar').getByRole('button',{name:'Impostazioni',exact:true}).click();
 const toggle=page.getByRole('switch',{name:'Mantieni aperta la finestra Aggiungi materiale',exact:true});
 await expect(toggle).toBeVisible();if(await toggle.isChecked())await toggle.uncheck();
 await expect(toggle).toBeEnabled();await expect(toggle).not.toBeChecked();
}
