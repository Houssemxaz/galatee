import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function MenuPreviewDialog({ item, onOpenChange }) {
  const revision = item?.draft || item?.current;
  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onOpenChange(null)}>
      <DialogContent className="bo-dialog">
        {revision && (
          <>
            <DialogHeader>
              <DialogTitle>{revision.title}</DialogTitle>
              <DialogDescription>{revision.shortDescription}</DialogDescription>
            </DialogHeader>
            <div className="bo-preview">
              {revision.imageUrl && <img src={revision.imageUrl} alt={revision.imageAlt || ""} className="bo-preview-image" />}
              <p className="bo-preview-price">{revision.price} {revision.currency}</p>
              <p className="bo-preview-long">{revision.longDescription}</p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
