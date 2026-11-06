import { useNavigate } from "@tanstack/react-router";
import { Crown, Store } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PREMIUM_PRICE_LABEL } from "@/lib/pricing";

/**
 * Aviso de que o plano gratuito permite 1 restaurante por conta.
 *
 * O gate de verdade é o trigger `guard_restaurant_limit` no banco; este diálogo
 * só explica o motivo e leva ao fluxo de assinatura, em vez de deixar o INSERT
 * falhar com um erro cru. A diária de 24h não libera multi-loja — só o Premium.
 */
export function RestaurantLimitDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#12121a] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Crown className="size-4 text-amber-300" />
            Um restaurante no plano gratuito
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Sua conta já tem um restaurante. Criar mais de um é um benefício do Premium.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-300">
            <Store className="size-4" />
          </span>
          <p className="text-sm leading-relaxed text-amber-100">
            No Premium você cria quantos restaurantes quiser, com pedidos ilimitados e os itens
            liberados na hora.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/10 bg-white/[0.04] text-gray-300 hover:bg-white/[0.08]"
          >
            Agora não
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              navigate({ to: "/admin/assinatura" });
            }}
            className="rounded-full bg-cyan-500 font-bold text-black hover:bg-cyan-400"
          >
            Assinar Premium · {PREMIUM_PRICE_LABEL}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
