import { z } from 'zod';

/**
 * Strict schema for CKBFS BlogPost Content.
 * Ensures the metadata encoded inside the witness strictly adheres to this structure.
 */
export const blogPostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(150, 'Title is too long'),
  description: z.string().max(300, 'Description is too long').optional(),
  author: z.string().min(1, 'Author is required'),
  tags: z.array(z.string()).max(10, 'Too many tags').default([]),
  created_at: z.number().int().positive('Invalid creation timestamp'),
  updated_at: z.number().int().positive('Invalid update timestamp'),
  cover_image: z.string().url('Cover image must be a valid URL').optional().or(z.literal('')),
  content: z.string().min(1, 'Content cannot be empty'),
});

export type ValidatedBlogPost = z.infer<typeof blogPostSchema>;

/**
 * Validates raw blog post data. Throws detailed errors if validation fails.
 */
export function validateBlogPostContent(data: unknown): ValidatedBlogPost {
  return blogPostSchema.parse(data);
}
