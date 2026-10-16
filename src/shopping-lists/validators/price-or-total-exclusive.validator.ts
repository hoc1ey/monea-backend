import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

interface CloseItemLike {
  price?: unknown;
}

interface CloseDtoLike {
  purchasedItems?: CloseItemLike[];
  total?: unknown;
}

/**
 * Valida la regla excluyente (XOR) del cierre: o TODOS los ítems comprados
 * traen `price` (y no se envía `total`), o se envía `total` y NINGÚN ítem trae
 * `price`. Ambas o ninguna son inválidas.
 */
@ValidatorConstraint({ name: 'isPriceOrTotalExclusive', async: false })
export class PriceOrTotalExclusiveConstraint
  implements ValidatorConstraintInterface
{
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as CloseDtoLike;
    const items = Array.isArray(dto.purchasedItems) ? dto.purchasedItems : [];
    const withPrice = items.filter(
      (item) => item?.price !== undefined && item?.price !== null,
    );
    const hasPrice = withPrice.length > 0;
    const allHavePrice = items.length > 0 && withPrice.length === items.length;
    const hasTotal = dto.total !== undefined && dto.total !== null;

    if (hasPrice && hasTotal) {
      return false;
    }
    if (hasPrice && !allHavePrice) {
      return false;
    }
    return hasPrice || hasTotal;
  }

  defaultMessage(): string {
    return 'Debes enviar el precio de todos los ítems comprados o un total, pero no ambos';
  }
}

export function IsPriceOrTotalExclusive(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isPriceOrTotalExclusive',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: PriceOrTotalExclusiveConstraint,
    });
  };
}
