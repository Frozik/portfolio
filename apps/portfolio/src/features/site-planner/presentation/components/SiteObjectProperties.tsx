import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';

import { RadioGroup } from '../../../../shared/ui/RadioGroup';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { CarInstance, TreeInstance } from '../../domain/model/plot-objects';
import { changeTreeSpecies, parseTreeSpecies, TREE_SPECIES } from '../../domain/model/plot-objects';
import { DEGREE_DECIMALS, METER_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';
import { PropertyField } from './PropertyField';

/** And for a tree, whose four numbers are edited the same way. */
type TreeField = 'position-x' | 'position-y' | 'crown-radius' | 'height' | 'species';

/** A car has no dimensions to type — only where it stands and where it faces. */
type CarField = 'position-x' | 'position-y' | 'rotation';

const SPECIES_OPTIONS = TREE_SPECIES.map(species => ({
  value: species,
  label: sitePlannerT.properties.species[species],
}));

const TreeProperties = memo(
  ({
    tree,
    onChange,
  }: {
    readonly tree: TreeInstance;
    readonly onChange: (tree: TreeInstance, field: TreeField) => void;
  }) => {
    const handleSpeciesChange = useFunction((value: string) => {
      const species = parseTreeSpecies(value);

      if (!isNil(species)) {
        onChange(changeTreeSpecies(tree, species), 'species');
      }
    });
    const handlePositionXChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        onChange({ ...tree, position: { ...tree.position, x: value } }, 'position-x');
      }
    });
    const handlePositionYChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        onChange({ ...tree, position: { ...tree.position, y: value } }, 'position-y');
      }
    });
    const handleCrownRadiusChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        onChange({ ...tree, crownRadius: value }, 'crown-radius');
      }
    });
    const handleHeightChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        onChange({ ...tree, height: value }, 'height');
      }
    });

    return (
      <div className="flex flex-col gap-2">
        <span className="text-[11px] text-text-secondary">
          {sitePlannerT.properties.speciesLabel}
        </span>
        <RadioGroup options={SPECIES_OPTIONS} value={tree.species} onChange={handleSpeciesChange} />
        <PropertyField
          label={sitePlannerT.properties.centerX}
          value={tree.position.x}
          decimal={METER_DECIMALS}
          allowNegative
          onValueChange={handlePositionXChange}
        />
        <PropertyField
          label={sitePlannerT.properties.centerY}
          value={tree.position.y}
          decimal={METER_DECIMALS}
          allowNegative
          onValueChange={handlePositionYChange}
        />
        <PropertyField
          label={sitePlannerT.properties.crownRadius}
          value={tree.crownRadius}
          decimal={METER_DECIMALS}
          onValueChange={handleCrownRadiusChange}
        />
        <PropertyField
          label={sitePlannerT.properties.treeHeight}
          value={tree.height}
          decimal={METER_DECIMALS}
          onValueChange={handleHeightChange}
        />
      </div>
    );
  }
);

const CarProperties = memo(
  ({
    car,
    onChange,
  }: {
    readonly car: CarInstance;
    readonly onChange: (car: CarInstance, field: CarField) => void;
  }) => {
    const handlePositionXChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        onChange({ ...car, position: { ...car.position, x: value } }, 'position-x');
      }
    });
    const handlePositionYChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        onChange({ ...car, position: { ...car.position, y: value } }, 'position-y');
      }
    });
    const handleRotationChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        onChange({ ...car, rotationDegrees: value }, 'rotation');
      }
    });

    return (
      <div className="flex flex-col gap-2">
        <PropertyField
          label={sitePlannerT.properties.centerX}
          value={car.position.x}
          decimal={METER_DECIMALS}
          allowNegative
          onValueChange={handlePositionXChange}
        />
        <PropertyField
          label={sitePlannerT.properties.centerY}
          value={car.position.y}
          decimal={METER_DECIMALS}
          allowNegative
          onValueChange={handlePositionYChange}
        />
        <PropertyField
          label={sitePlannerT.properties.rotation}
          value={car.rotationDegrees}
          decimal={DEGREE_DECIMALS}
          allowNegative
          onValueChange={handleRotationChange}
        />
      </div>
    );
  }
);

export const SelectedTreeProperties = observer(
  ({ store, tree }: { readonly store: SitePlannerStore; readonly tree: TreeInstance }) => {
    const handleChange = useFunction((nextTree: TreeInstance, field: TreeField) => {
      store.pushHistory(`${nextTree.id}:${field}`);
      store.siteObjects.updateTree(nextTree);
    });

    return <TreeProperties tree={tree} onChange={handleChange} />;
  }
);

export const SelectedCarProperties = observer(
  ({ store, car }: { readonly store: SitePlannerStore; readonly car: CarInstance }) => {
    const handleChange = useFunction((nextCar: CarInstance, field: CarField) => {
      store.pushHistory(`${nextCar.id}:${field}`);
      store.siteObjects.updateCar(nextCar);
    });

    return <CarProperties car={car} onChange={handleChange} />;
  }
);
