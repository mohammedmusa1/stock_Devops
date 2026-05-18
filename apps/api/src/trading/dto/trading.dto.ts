import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { OrderSide, OrderType } from '@prisma/client';

export class PlaceOrderDto {
  @IsEnum(OrderSide)
  side!: OrderSide;

  @IsEnum(OrderType)
  type!: OrderType;

  @IsNumber()
  @Min(0.000001)
  quantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  limitPrice?: number;
}
