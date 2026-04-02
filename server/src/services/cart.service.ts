import { prisma } from "../lib/prisma.js";
import { conflict, notFound } from "../lib/errors.js";

async function getOrCreateCart(userId: string) {
  let cart = await prisma.cart.findUnique({ where: { userId }, include: { items: { include: { game: { include: { publisher: { select: { name: true, slug: true } } } } } } } });
  if (!cart) {
    cart = await prisma.cart.create({ data: { userId }, include: { items: { include: { game: { include: { publisher: { select: { name: true, slug: true } } } } } } } });
  }
  return cart;
}

export async function getCart(userId: string) {
  return getOrCreateCart(userId);
}

export async function addToCart(userId: string, gameId: string) {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw notFound("Game not found");

  // Check if already owned
  const owned = await prisma.libraryItem.findUnique({ where: { userId_gameId: { userId, gameId } } });
  if (owned) throw conflict("Already in library");

  const cart = await getOrCreateCart(userId);
  const existing = await prisma.cartItem.findUnique({ where: { cartId_gameId: { cartId: cart.id, gameId } } });
  if (existing) throw conflict("Already in cart");

  await prisma.cartItem.create({ data: { cartId: cart.id, gameId } });
  return getOrCreateCart(userId);
}

export async function removeFromCart(userId: string, gameId: string) {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) throw notFound("Cart not found");

  const item = await prisma.cartItem.findUnique({ where: { cartId_gameId: { cartId: cart.id, gameId } } });
  if (!item) throw notFound("Not in cart");

  await prisma.cartItem.delete({ where: { id: item.id } });
  return getOrCreateCart(userId);
}

export async function clearCart(userId: string) {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (cart) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }
  return getOrCreateCart(userId);
}
