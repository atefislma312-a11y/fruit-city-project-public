import React,{useEffect,useRef} from 'react';
export function ProductStory({story,product,onClose,onOrder,t}){
 const ref=useRef(null);
 useEffect(()=>{ref.current?.showModal();},[]);
 return <dialog className="product-story" ref={ref} aria-labelledby="product-story-title" onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===ref.current)onClose();}}>
  <button className="story-back" onClick={onClose}>{t("← الرجوع للمنيو")}</button>
  {story?<article><div className="story-picture"><img src={story.image} alt={product?.name||story.title}/><span>{t("Fruit City · حكاية كل عصير")}</span></div>
   <div className="story-paper">{story.preview&&<p className="story-preview">{t("معاينة تصميم فقط — المحتوى المعتمد يُضاف لاحقًا")}</p>}<small>{product?.name}</small><h1 id="product-story-title">{story.title}</h1><div className="story-rule">✦</div>{story.paragraphs.map((p,i)=><p key={i}>{p}</p>)}<button className="story-order" onClick={onOrder}>{t("اطلب العصير ←")}</button></div>
  </article>:<div className="story-paper"><h1 id="product-story-title">{t("القصة غير متاحة حاليًا")}</h1><p>{t("ارجع للمنيو لاختيار عصيرك.")}</p></div>}
 </dialog>;
}
