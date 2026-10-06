import { auth } from "@/auth";
import { PetScreen } from "@/components/pet/pet-screen";
import { getPetState } from "@/server/pet";

export default async function FoguinhoPage() {
  const pet = await getPetState((await auth())!.user!.id!);
  return <PetScreen pet={pet} />;
}
