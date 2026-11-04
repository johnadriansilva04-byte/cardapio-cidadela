// Forma dos dados do restaurante no formulário/diálogo.
//
// Vive fora de `RestaurantDialog.tsx` porque o modo conversa, os testes e o
// extrator de IA compartilham o mesmo tipo — um arquivo só de componentes
// mantém o fast refresh funcionando.

import {
  DEFAULT_OPERATING_HOURS,
  normalizeOperatingHours,
  type OperatingHours,
} from "@/lib/operatingHours";
import type { Restaurant, RestaurantStatus } from "@/lib/types";

export type RestaurantFormValues = {
  name: string;
  slug: string;
  description: string;
  phone: string;
  whatsapp: string;
  address: string;
  logo_url: string;
  banner_url: string;
  primary_color: string;
  secondary_color: string;
  status: RestaurantStatus;
  pix_key: string;
  delivery_fee: string;
  operating_hours: OperatingHours;
};

/** Retorno do envio: o id é necessário para enviar as imagens recém-escolhidas. */
export type RestaurantSubmitResult = { id: string } | Restaurant | null | void;

/** Valores iniciais do formulário — também usado pelo modo conversa. */
export function buildInitialFormValues(restaurant: Restaurant | null): RestaurantFormValues {
  return {
    name: restaurant?.name ?? "",
    slug: restaurant?.slug ?? "",
    description: restaurant?.description ?? "",
    phone: restaurant?.phone ?? "",
    whatsapp: restaurant?.whatsapp ?? "",
    address: restaurant?.address ?? "",
    logo_url: restaurant?.logo_url ?? "",
    banner_url: restaurant?.banner_url ?? "",
    primary_color: restaurant?.primary_color ?? "#06b6d4",
    secondary_color: restaurant?.secondary_color ?? "#8b5cf6",
    status: (restaurant?.status as RestaurantStatus) ?? "published",
    pix_key: restaurant?.pix_key ?? "",
    delivery_fee: restaurant?.delivery_fee ? String(restaurant.delivery_fee) : "",
    operating_hours: restaurant?.operating_hours
      ? normalizeOperatingHours(restaurant.operating_hours)
      : { ...DEFAULT_OPERATING_HOURS },
  };
}
