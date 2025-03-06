import {describe, expect, test} from '@jest/globals';
import {makeBlock, setupCodeMatcher} from '../shared.js';
import injector from '../../injectors/modifyScriptSetupAst.js';


// Setup the custom matcher
setupCodeMatcher();

describe('injector', () => {
  test('handles code with no useFusion import', () => {
    const code = `
      import something from 'somewhere';
      const x = 1;
  `;

    const result = injector(code, 'test.js', ['name', 'email']);

    expect(result.code).toMatchCode(`
      import something from 'somewhere';
      import { useFusion } from "__aliasedFusionPath__";
      const { data: data } = useFusion(["name", "email"], __props.fusion);
      const x = 1;
    `);
  });

  test('handles code with useFusion import and specific keys', () => {
    const code = `
      import { useFusion } from '@/lib/fusion';
      const { data } = useFusion(['name']);
    `;

    const result = injector(code, 'test.js', ['name', 'email']);

    expect(result.code).toMatchCode(`
      import { useFusion } from "__aliasedFusionPath__";
      const { email: email } = useFusion(["email"], __props.fusion);
      const { data } = useFusion(['name'], __props.fusion);
    `);
  });

  test('handles code with different useFusion import and specific keys', () => {
    const code = `
      import { useFusion } from '@/lib/asdfasdfasdfasdfasdfasdfasdf';
      const { data } = useFusion(['name']);
    `;

    const result = injector(code, 'test.js', ['name', 'email']);

    expect(result.code).toMatchCode(`
      import { useFusion } from "__aliasedFusionPath__";
      const { email: email } = useFusion(["email"], __props.fusion);
      const { data } = useFusion(['name'], __props.fusion);
    `);
  });

  test('handles empty array parameter', () => {
    const code = `
      import { useFusion } from '@/lib/fusion';
      const { data } = useFusion([]);
    `;

    const result = injector(code, 'test.js', ['name', 'email']);
    expect(result.code).toMatchCode(`
      import { useFusion } from "__aliasedFusionPath__";
      const { name: name, email: email } = useFusion(["name", "email"], __props.fusion);
      const { data } = useFusion([], __props.fusion);
    `);
  });

  test('handles whitespace variations', () => {
    const code = `
      import { useFusion } from '@/lib/fusion';
      const { data } = useFusion  (  ['name']  );
    `;

    const result = injector(code, 'test.js', ['name', 'email']);
    expect(result.code).toMatchCode(`
      import { useFusion } from "__aliasedFusionPath__";
      const { email: email } = useFusion(["email"], __props.fusion);
      const { data } = useFusion(['name'], __props.fusion);
    `);
  });

  test('handles useFusion with multiline parameter formatting', () => {
    const code = `
      import { useFusion } from '@/lib/fusion';
      const { data } = useFusion([
        'name',
        'email'
      ]);
    `;

    const result = injector(code, 'test.js', ['name', 'email', 'phone']);
    expect(result.code).toMatchCode(`
      import { useFusion } from "__aliasedFusionPath__";
      const { phone: phone } = useFusion(["phone"], __props.fusion);
      const { data } = useFusion([ 'name', 'email' ], __props.fusion);
    `);
  });

  test('handles useFusion import with other imports', () => {
    const code = `
      import { something } from 'somewhere';
      import { useFusion, otherThing } from '@/lib/fusion';
      import another from 'another-place';
      const { data } = useFusion(['name']);
    `;

    const result = injector(code, 'test.js', ['name', 'email']);
    expect(result.code).toMatchCode(`
      import { something } from 'somewhere'; 
      import { useFusion, otherThing } from "__aliasedFusionPath__"; 
      import another from 'another-place'; 
      const { email: email } = useFusion(["email"], __props.fusion); 
      const { data } = useFusion(['name'], __props.fusion);
    `);
  });

  test('handles double quoted strings in useFusion parameters', () => {
    const code = `
      import { useFusion } from '@/lib/fusion';
      const { data } = useFusion(["name"]);
    `;

    const result = injector(code, 'test.js', ['name', 'email']);

    expect(result.code).toMatchCode(`
      import { useFusion } from "__aliasedFusionPath__";
      const { email: email } = useFusion(["email"], __props.fusion);
      const { data } = useFusion(["name"], __props.fusion);
    `);
  });

  test('handles mixed quote types in parameters', () => {
    const code = `
      import { useFusion } from '@/lib/fusion';
      const { data } = useFusion(['name', "email"]);
    `;

    const result = injector(code, 'test.js', ['name', 'email', 'phone']);
    expect(result.code).toMatchCode(`
      import { useFusion } from "__aliasedFusionPath__";
      const { phone: phone } = useFusion(["phone"], __props.fusion);
      const { data } = useFusion(['name', "email"], __props.fusion);
    `);
  });

  test('handles code with no useFusion call or import', () => {
    const code = `
    const x = 42;
  `;

    const result = injector(code, 'test.js', ['a', 'b']);
    expect(result.code).toMatchCode(`
      import { useFusion } from "__aliasedFusionPath__";
      const { data: data } = useFusion(["a", "b"], __props.fusion);
      const x = 42;
    `);
  });

  test('handles useFusion call with trailing comma in parameters', () => {
    const code = `
    import { useFusion } from '@/lib/fusion';
    const data = useFusion(['name',]);
  `;

    const result = injector(code, 'test.js', ['name', 'email']);

    expect(result.code).toMatchCode(`
      import { useFusion } from "__aliasedFusionPath__";
      const { email: email } = useFusion(["email"], __props.fusion);
      const data = useFusion(['name',], __props.fusion);
    `);
  });

  test('supports alias', () => {
    const code = `
      import { useFusion as uf } from '@/lib/fusion';
      const data = uf(['name']);
    `;

    const result = injector(code, 'test.js', ['name', 'email']);

    expect(result.code).toMatchCode(`
      import { useFusion as uf } from "__aliasedFusionPath__";
      const { email: email } = uf(["email"], __props.fusion);
      const data = uf(['name'], __props.fusion);
    `);
  });

  test('throws error if useFusion is called twice', () => {
    const code = `
    import { useFusion } from '@/lib/fusion';
    const a = useFusion(['name']);
    const b = useFusion(['email']);
  `;

    const result = injector(code, 'test.js', ['name', 'email', 'phone']);

    expect(result.code).toMatchCode(`
      import { useFusion } from "__aliasedFusionPath__";
      const { phone: phone } = useFusion(["phone"], __props.fusion);
      
      const a = useFusion(['name'], __props.fusion);
      const b = useFusion(['email'], __props.fusion);
    `);

  });

});