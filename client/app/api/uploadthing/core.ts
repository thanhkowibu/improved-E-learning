import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { getAuthUser } from "@/lib/auth/get-auth-user";

const f = createUploadthing();

export const uploadRouter = {
  courseMaterialUploader: f({
    pdf: {
      maxFileSize: "32MB",
      maxFileCount: 10,
    },
    video: {
      maxFileSize: "512MB",
      maxFileCount: 1,
    },
    image: {
      maxFileSize: "8MB",
      maxFileCount: 5,
    },
  })
    .middleware(async ({ req }) => {
      try {
        const user = await getAuthUser(req);

        if (user.role !== "TEACHER" && user.role !== "ADMIN") {
          throw new UploadThingError({
            code: "FORBIDDEN",
            message: "Only teachers and admins can upload course materials.",
          });
        }

        return {
          userId: user.id,
          role: user.role,
        };
      } catch (error) {
        if (error instanceof UploadThingError) {
          throw error;
        }

        throw new UploadThingError({
          code: "FORBIDDEN",
          message: "You must be signed in to upload files.",
        });
      }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return {
        uploadedBy: metadata.userId,
        role: metadata.role,
        key: file.key,
        name: file.name,
        size: file.size,
        type: file.type,
        url: file.ufsUrl,
      };
    }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
