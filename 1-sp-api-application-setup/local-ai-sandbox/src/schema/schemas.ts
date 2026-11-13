import z from "zod";

export const ResponseSchema = z.object({
  statusCode: z.number(),
  body: z.string().optional(),
});
