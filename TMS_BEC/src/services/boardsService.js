import httpStatus from "http-status";
import { Board } from "../models/index.js";
import ApiError from "../utils/ApiError.js";
import { now } from "../lib/time.js";

export const listBoards = async (user) => {
  const boards = await Board.findAll({
    where: { owner_id: user.id },
    attributes: ["id", "name", "scene", "updated_at"],
    order: [["updated_at", "DESC"]],
    raw: true,
  });
  return { boards };
};

export const saveBoard = async (user, { id, name, scene }) => {
  if (!name?.trim()) throw new ApiError(httpStatus.BAD_REQUEST, "Board name required");

  const t = now();
  const sceneJson = JSON.stringify(scene ?? []);

  if (id) {
    const [updated] = await Board.update(
      { name: name.trim(), scene: sceneJson, updated_at: t },
      { where: { id, owner_id: user.id } }
    );
    if (!updated) throw new ApiError(httpStatus.BAD_REQUEST, "Board not found");
    return { id: Number(id) };
  }

  const board = await Board.create({
    name: name.trim(),
    owner_id: user.id,
    scene: sceneJson,
    updated_at: t,
    created_at: t,
  });

  return { id: board.id };
};

export const deleteBoard = async (user, id) => {
  if (!id) throw new ApiError(httpStatus.BAD_REQUEST, "id required");
  await Board.destroy({ where: { id: Number(id), owner_id: user.id } });
  return { ok: true };
};

export default { listBoards, saveBoard, deleteBoard };
