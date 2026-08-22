import { writeFile } from 'node:fs/promises';
import { parse } from 'webidl2';

const SOURCE_URL =
  'https://raw.githubusercontent.com/mozilla-firefox/firefox/main/dom/chrome-webidl/MediaController.webidl';

const OUTPUT_FILE = 'types/gecko-media.generated.d.ts';

type IDLType = {
  idlType: string | IDLType[];
  generic?: string;
  union?: boolean;
};

type Attribute = {
  type: 'attribute';
  name: string;
  readonly: boolean;
  idlType: IDLType;
};

type Argument = {
  name: string;
  optional: boolean;
  idlType: IDLType;
};

type Operation = {
  type: 'operation';
  name: string;
  arguments: Argument[];
  idlType: IDLType;
};

type Interface = {
  type: 'interface';
  name: string;
  inheritance?: string;
  members: Array<Attribute | Operation>;
};

type Enum = {
  type: 'enum';
  name: string;
  values: Array<{ value: string }>;
};

type Namespace = {
  type: 'namespace';
  name: string;
  members: Operation[];
};

type Definition = Interface | Enum | Namespace;

export async function generateGeckoMedia(): Promise<string> {
  console.log(`Fetching ${SOURCE_URL}`);

  const response = await fetch(SOURCE_URL);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch WebIDL: ${response.status} ${response.statusText}`,
    );
  }

  const source = await response.text();

  if (!source.includes('interface MediaController')) {
    throw new Error(
      'Fetched content does not contain MediaController interface',
    );
  }

  const definitions = parse(source) as unknown as Definition[];

  console.log(`Parsed ${definitions.length} definitions`);

  function tsType(type: IDLType): string {
    if (type.union) {
      if (!Array.isArray(type.idlType)) {
        throw new Error('Expected union IDL type to contain an array');
      }

      return type.idlType.map(tsType).join(' | ');
    }

    if (type.generic === 'sequence') {
      if (!Array.isArray(type.idlType) || type.idlType.length !== 1) {
        throw new Error('Expected sequence<T>');
      }

      return `readonly ${tsType(type.idlType[0])}[]`;
    }

    if (Array.isArray(type.idlType)) {
      throw new Error(`Unsupported IDL type: ${JSON.stringify(type)}`);
    }

    const primitiveTypes: Record<string, string> = {
      boolean: 'boolean',
      byte: 'number',
      octet: 'number',
      short: 'number',
      'unsigned short': 'number',
      long: 'number',
      'unsigned long': 'number',
      'long long': 'number',
      'unsigned long long': 'number',
      float: 'number',
      'unrestricted float': 'number',
      double: 'number',
      'unrestricted double': 'number',
      DOMString: 'string',
      ByteString: 'string',
      USVString: 'string',
      undefined: 'void',
      object: 'object',
      symbol: 'symbol',
      any: 'any',
    };

    return primitiveTypes[type.idlType] ?? type.idlType;
  }

  function renderEnum(definition: Enum): string {
    const values = definition.values
      .map(({ value }) => `  | ${JSON.stringify(value)}`)
      .join('\n');

    return `type ${definition.name} =\n${values};`;
  }

  function renderAttribute(member: Attribute): string {
    const readonly = member.readonly ? 'readonly ' : '';

    return `  ${readonly}${member.name}: ${tsType(member.idlType)};`;
  }

  function renderArgument(argument: Argument): string {
    const optional = argument.optional ? '?' : '';

    return `${argument.name}${optional}: ${tsType(argument.idlType)}`;
  }

  function renderOperation(member: Operation): string {
    const args = member.arguments.map(renderArgument).join(', ');

    return `  ${member.name}(${args}): ${tsType(member.idlType)};`;
  }

  function renderInterface(definition: Interface): string {
    const inheritance = definition.inheritance
      ? ` extends ${definition.inheritance}`
      : '';

    const members = definition.members
      .map((member) => {
        switch (member.type) {
          case 'attribute':
            return renderAttribute(member);

          case 'operation':
            return renderOperation(member);

          default:
            throw new Error(`Unsupported interface member: ${String(member)}`);
        }
      })
      .join('\n');

    return `interface ${definition.name}${inheritance} {\n${members}\n}`;
  }

  function renderNamespace(definition: Namespace): string {
    const members = definition.members
      .map((member) => {
        const args = member.arguments.map(renderArgument).join(', ');

        return `  function ${member.name}(${args}): ${tsType(member.idlType)};`;
      })
      .join('\n');

    return `declare namespace ${definition.name} {\n${members}\n}`;
  }

  function renderDefinition(definition: Definition): string {
    switch (definition.type) {
      case 'enum':
        return renderEnum(definition);

      case 'interface':
        return renderInterface(definition);

      case 'namespace':
        return renderNamespace(definition);

      default:
        throw new Error(`Unsupported WebIDL definition: ${String(definition)}`);
    }
  }

  return [
    '// GENERATED FILE — DO NOT EDIT',
    `// Source: ${SOURCE_URL}`,
    '',
    ...definitions.flatMap((definition) => [renderDefinition(definition), '']),
  ].join('\n');
}

const generated = await generateGeckoMedia();

await writeFile(OUTPUT_FILE, generated, 'utf8');

console.log(`Generated ${OUTPUT_FILE}`);
